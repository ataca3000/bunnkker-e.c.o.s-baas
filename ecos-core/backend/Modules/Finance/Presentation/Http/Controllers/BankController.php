<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Modules\Finance\Banking\Domain\Models\BankAccount;
use Modules\Finance\Banking\Domain\Models\BankReconciliation;
use Modules\Finance\Banking\Domain\Models\BankStatement;
use Modules\Finance\Banking\Domain\Models\BankStatementLine;
use Modules\Finance\Banking\Domain\Services\BankingService;
use Modules\Finance\Banking\Domain\Services\BankReconciliationService;
use Modules\Finance\Presentation\Http\Controllers\Concerns\ResolvesFinanceContext;

/**
 * Banking: accounts, statement import, reconciliation rules, and the manual +
 * automatic reconciliation workflow. Reconciliation writes no ledger — it only
 * matches statement lines to book movements and proves the balance ties.
 */
class BankController extends Controller
{
    use ResolvesFinanceContext;

    public function __construct(
        private readonly BankingService $banking,
        private readonly BankReconciliationService $reconciler,
    ) {}

    // ── Accounts ───────────────────────────────────────────────────────────────

    public function accounts(Request $request): JsonResponse
    {
        $accounts = BankAccount::query()
            ->where('company_id', $this->companyId($request))
            ->orderBy('name')
            ->get()
            ->map(fn (BankAccount $a) => [
                'id' => $a->uuid,
                'name' => $a->name,
                'bank_name' => $a->bank_name,
                'iban' => $a->iban,
                'currency' => $a->currency,
                'is_active' => $a->is_active,
            ]);

        return response()->json(['data' => $accounts]);
    }

    public function storeAccount(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:200'],
            'gl_account_id' => ['required', 'string'], // uuid
            'bank_name' => ['nullable', 'string', 'max:200'],
            'account_number' => ['nullable', 'string', 'max:64'],
            'iban' => ['nullable', 'string', 'max:64'],
            'swift' => ['nullable', 'string', 'max:32'],
            'currency' => ['nullable', 'string', 'size:3'],
        ]);

        $account = $this->banking->createAccount(
            companyId: $this->companyId($request),
            name: $validated['name'],
            glAccountId: $this->accountId($request, $validated['gl_account_id']),
            bankName: $validated['bank_name'] ?? null,
            accountNumber: $validated['account_number'] ?? null,
            iban: $validated['iban'] ?? null,
            swift: $validated['swift'] ?? null,
            currency: $validated['currency'] ?? 'EGP',
        );

        return response()->json(['data' => ['id' => $account->uuid, 'name' => $account->name]], 201);
    }

    // ── Statements ─────────────────────────────────────────────────────────────

    public function importStatement(Request $request, string $accountUuid): JsonResponse
    {
        $validated = $request->validate([
            'statement_date' => ['required', 'date'],
            'opening_balance' => ['required', 'numeric'],
            'closing_balance' => ['required', 'numeric'],
            'reference' => ['nullable', 'string', 'max:120'],
            'period_start' => ['nullable', 'date'],
            'period_end' => ['nullable', 'date'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.value_date' => ['required', 'date'],
            'lines.*.amount' => ['required', 'numeric'],
            'lines.*.description' => ['nullable', 'string', 'max:500'],
            'lines.*.external_reference' => ['nullable', 'string', 'max:120'],
        ]);

        $account = $this->account($request, $accountUuid);

        $statement = $this->banking->importStatement(
            account: $account,
            statementDate: Carbon::parse($validated['statement_date']),
            openingBalance: (float) $validated['opening_balance'],
            closingBalance: (float) $validated['closing_balance'],
            lines: $validated['lines'],
            reference: $validated['reference'] ?? null,
            periodStart: isset($validated['period_start']) ? Carbon::parse($validated['period_start']) : null,
            periodEnd: isset($validated['period_end']) ? Carbon::parse($validated['period_end']) : null,
            createdBy: $this->actorId($request),
        );

        return response()->json(['data' => [
            'id' => $statement->uuid,
            'status' => $statement->status,
            'lines' => $statement->lines()->count(),
        ]], 201);
    }

    public function createRule(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:200'],
            'match_value' => ['required', 'string', 'max:500'],
            'match_type' => ['nullable', Rule::in(['contains', 'equals', 'regex', 'amount'])],
            'match_field' => ['nullable', Rule::in(['description', 'external_reference', 'amount'])],
            'bank_account_id' => ['nullable', 'string'], // uuid
            'target_account_id' => ['nullable', 'string'], // uuid
            'priority' => ['nullable', 'integer'],
        ]);

        $rule = $this->banking->createRule(
            companyId: $this->companyId($request),
            name: $validated['name'],
            matchValue: $validated['match_value'],
            matchType: $validated['match_type'] ?? 'contains',
            matchField: $validated['match_field'] ?? 'description',
            bankAccountId: isset($validated['bank_account_id']) ? (int) $this->account($request, $validated['bank_account_id'])->id : null,
            targetAccountId: isset($validated['target_account_id']) ? $this->accountId($request, $validated['target_account_id']) : null,
            priority: (int) ($validated['priority'] ?? 100),
        );

        return response()->json(['data' => ['id' => $rule->uuid, 'name' => $rule->name]], 201);
    }

    // ── Reconciliation ─────────────────────────────────────────────────────────

    public function startReconciliation(Request $request, string $statementUuid): JsonResponse
    {
        $statement = BankStatement::query()
            ->where('company_id', $this->companyId($request))
            ->where('uuid', $statementUuid)
            ->firstOrFail();

        $recon = $this->reconciler->start($statement, $this->actorId($request));

        return response()->json(['data' => $this->reconPayload($recon)], 201);
    }

    public function autoMatch(Request $request, string $reconUuid): JsonResponse
    {
        $recon = $this->reconciliation($request, $reconUuid);
        $matched = $this->reconciler->autoMatch($recon);

        return response()->json(['data' => ['matched' => $matched] + $this->reconPayload($recon->fresh())]);
    }

    public function manualMatch(Request $request, string $reconUuid): JsonResponse
    {
        $validated = $request->validate([
            'line_id' => ['required', 'integer'],
            'source_type' => ['required', 'string', 'max:40'],
            'source_id' => ['required', 'integer'],
        ]);

        $recon = $this->reconciliation($request, $reconUuid);
        $line = BankStatementLine::query()
            ->where('company_id', $this->companyId($request))
            ->where('id', $validated['line_id'])
            ->firstOrFail();

        $line = $this->reconciler->manualMatch($recon, $line, $validated['source_type'], (int) $validated['source_id']);

        return response()->json(['data' => ['line_id' => $line->id, 'match_status' => $line->match_status]]);
    }

    public function outstanding(Request $request, string $reconUuid): JsonResponse
    {
        $recon = $this->reconciliation($request, $reconUuid);

        return response()->json(['data' => $this->reconciler->outstandingItems($recon)]);
    }

    public function complete(Request $request, string $reconUuid): JsonResponse
    {
        $recon = $this->reconciler->complete($this->reconciliation($request, $reconUuid), $this->actorId($request));

        return response()->json(['data' => $this->reconPayload($recon)]);
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private function account(Request $request, string $uuid): BankAccount
    {
        return BankAccount::query()
            ->where('company_id', $this->companyId($request))
            ->where('uuid', $uuid)
            ->firstOrFail();
    }

    private function reconciliation(Request $request, string $uuid): BankReconciliation
    {
        return BankReconciliation::query()
            ->where('company_id', $this->companyId($request))
            ->where('uuid', $uuid)
            ->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function reconPayload(BankReconciliation $r): array
    {
        return [
            'id' => $r->uuid,
            'status' => $r->status,
            'book_balance' => (float) $r->book_balance,
            'statement_balance' => (float) $r->statement_balance,
            'difference' => (float) $r->difference,
            'completed_at' => $r->completed_at?->toIso8601String(),
        ];
    }
}
