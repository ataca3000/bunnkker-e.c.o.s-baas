<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Modules\Finance\Cash\Domain\Models\CashAccount;
use Modules\Finance\Cash\Domain\Models\CashSession;
use Modules\Finance\Cash\Domain\Services\CashService;
use Modules\Finance\Presentation\Http\Controllers\Concerns\ResolvesFinanceContext;

/**
 * Cash management: accounts, sessions, transactions and transfers. Every
 * movement posts through the Posting Engine; balances live in the GL.
 */
class CashController extends Controller
{
    use ResolvesFinanceContext;

    public function __construct(private readonly CashService $cash) {}

    public function accounts(Request $request): JsonResponse
    {
        $accounts = CashAccount::query()
            ->where('company_id', $this->companyId($request))
            ->orderBy('code')
            ->get()
            ->map(fn (CashAccount $a) => [
                'id' => $a->uuid,
                'code' => $a->code,
                'name' => $a->name,
                'currency' => $a->currency,
                'is_active' => $a->is_active,
            ]);

        return response()->json(['data' => $accounts]);
    }

    public function storeAccount(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:40'],
            'name' => ['required', 'string', 'max:200'],
            'gl_account_id' => ['required', 'string'], // uuid
            'branch_id' => ['nullable', 'string'],
            'currency' => ['nullable', 'string', 'size:3'],
        ]);

        $account = $this->cash->createAccount(
            companyId: $this->companyId($request),
            code: $validated['code'],
            name: $validated['name'],
            glAccountId: $this->accountId($request, $validated['gl_account_id']),
            branchId: $validated['branch_id'] ?? null,
            currency: $validated['currency'] ?? 'EGP',
        );

        return response()->json(['data' => ['id' => $account->uuid, 'code' => $account->code]], 201);
    }

    public function openSession(Request $request, string $accountUuid): JsonResponse
    {
        $validated = $request->validate(['opening_float' => ['nullable', 'numeric', 'gte:0']]);
        $account = $this->account($request, $accountUuid);

        $session = $this->cash->openSession($account, (float) ($validated['opening_float'] ?? 0), $this->actorId($request));

        return response()->json(['data' => ['id' => $session->uuid, 'status' => $session->status]], 201);
    }

    public function closeSession(Request $request, string $sessionUuid): JsonResponse
    {
        $validated = $request->validate(['counted_amount' => ['required', 'numeric', 'gte:0']]);
        $session = CashSession::query()
            ->where('company_id', $this->companyId($request))
            ->where('uuid', $sessionUuid)
            ->firstOrFail();

        $result = $this->cash->closeSession($session, (float) $validated['counted_amount'], $this->actorId($request));

        return response()->json(['data' => [
            'id' => $result['session']->uuid,
            'status' => $result['session']->status,
            'expected' => $result['expected'],
            'variance' => $result['variance'],
        ]]);
    }

    public function transaction(Request $request, string $accountUuid): JsonResponse
    {
        $validated = $request->validate([
            'type' => ['required', Rule::in(['receipt', 'payment', 'adjustment'])],
            'amount' => ['required', 'numeric', 'gt:0'],
            'counterparty_account_id' => ['required', 'string'], // uuid
            'transaction_date' => ['nullable', 'date'],
            'description' => ['nullable', 'string', 'max:500'],
        ]);

        $account = $this->account($request, $accountUuid);

        $txn = $this->cash->recordTransaction(
            account: $account,
            type: $validated['type'],
            amount: (float) $validated['amount'],
            counterpartyAccountId: $this->accountId($request, $validated['counterparty_account_id']),
            date: isset($validated['transaction_date']) ? Carbon::parse($validated['transaction_date']) : null,
            description: $validated['description'] ?? null,
            actorId: $this->actorId($request),
        );

        return response()->json(['data' => [
            'id' => $txn->uuid,
            'type' => $txn->transaction_type,
            'amount' => (float) $txn->amount,
            'journal_entry_id' => $txn->journal_entry_id,
        ]], 201);
    }

    public function transfer(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from_account_id' => ['required', 'string'], // cash account uuid
            'to_account_id' => ['required', 'string', 'different:from_account_id'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'transaction_date' => ['nullable', 'date'],
            'description' => ['nullable', 'string', 'max:500'],
        ]);

        $result = $this->cash->transfer(
            from: $this->account($request, $validated['from_account_id']),
            to: $this->account($request, $validated['to_account_id']),
            amount: (float) $validated['amount'],
            date: isset($validated['transaction_date']) ? Carbon::parse($validated['transaction_date']) : null,
            description: $validated['description'] ?? null,
            actorId: $this->actorId($request),
        );

        return response()->json(['data' => [
            'out' => $result['out']->uuid,
            'in' => $result['in']->uuid,
            'journal_entry_id' => $result['out']->journal_entry_id,
        ]], 201);
    }

    private function account(Request $request, string $uuid): CashAccount
    {
        return CashAccount::query()
            ->where('company_id', $this->companyId($request))
            ->where('uuid', $uuid)
            ->firstOrFail();
    }
}
