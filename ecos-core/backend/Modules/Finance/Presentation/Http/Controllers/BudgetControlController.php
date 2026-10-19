<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Modules\Finance\Budget\Domain\Enums\BudgetDimension;
use Modules\Finance\Budget\Domain\Models\BudgetCommitment;
use Modules\Finance\Budget\Domain\Models\BudgetControlRule;
use Modules\Finance\Budget\Domain\Services\BudgetControlEngine;
use Modules\Finance\Fiscal\Domain\Models\FiscalYear;
use Modules\Finance\Presentation\Http\Controllers\Concerns\ResolvesFinanceContext;

/**
 * Budget control: availability, the blocking-verdict primitive, commitments and
 * control rules. Read-only against Finance; it returns verdicts and manages its
 * own commitment/rule tables — it never posts or mutates the ledger.
 */
class BudgetControlController extends Controller
{
    use ResolvesFinanceContext;

    public function __construct(private readonly BudgetControlEngine $engine) {}

    public function availability(Request $request): JsonResponse
    {
        $v = $this->validateContext($request);

        return response()->json(['data' => $this->engine->availability(
            $this->companyId($request), (int) $this->year($request, $v['fiscal_year_id'])->id,
            $this->accountId($request, $v['account_id']),
            BudgetDimension::from($v['dimension_type'] ?? 'company'), $v['dimension_id'] ?? null, $v['period_number'] ?? null,
        )]);
    }

    /** The pre-commit check an operational flow calls: ok / warn / blocked. */
    public function evaluate(Request $request): JsonResponse
    {
        $v = $this->validateContext($request, withAmount: true);

        return response()->json(['data' => $this->engine->evaluate(
            $this->companyId($request), (int) $this->year($request, $v['fiscal_year_id'])->id,
            $this->accountId($request, $v['account_id']), (float) $v['amount'],
            BudgetDimension::from($v['dimension_type'] ?? 'company'), $v['dimension_id'] ?? null, $v['period_number'] ?? null,
        )]);
    }

    public function commit(Request $request): JsonResponse
    {
        $v = $this->validateContext($request, withAmount: true);

        $commitment = BudgetCommitment::create([
            'company_id' => $this->companyId($request),
            'account_id' => $this->accountId($request, $v['account_id']),
            'dimension_type' => $v['dimension_type'] ?? 'company',
            'dimension_id' => $v['dimension_id'] ?? null,
            'period_number' => $v['period_number'] ?? null,
            'amount' => round((float) $v['amount'], 4),
            'source_type' => $request->string('source_type')->toString() ?: null,
            'source_id' => $request->string('source_id')->toString() ?: null,
            'reference' => $request->string('reference')->toString() ?: null,
            'status' => 'committed',
            'committed_by' => $this->actorId($request),
        ]);

        return response()->json(['data' => ['id' => $commitment->uuid, 'amount' => (float) $commitment->amount]], 201);
    }

    public function release(Request $request, string $uuid): JsonResponse
    {
        $commitment = BudgetCommitment::query()
            ->where('company_id', $this->companyId($request))->where('uuid', $uuid)->firstOrFail();

        if ($commitment->isCommitted()) {
            $commitment->update(['status' => 'released', 'released_at' => Carbon::now()]);
        }

        return response()->json(['data' => ['id' => $commitment->uuid, 'status' => $commitment->status]]);
    }

    public function storeRule(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'scope' => ['nullable', Rule::in(['global', 'account', 'dimension'])],
            'account_id' => ['nullable', 'string'],
            'dimension_type' => ['nullable', 'string', 'max:20'],
            'dimension_id' => ['nullable', 'string', 'max:64'],
            'warn_threshold_pct' => ['nullable', 'numeric', 'between:0,999'],
            'block_threshold_pct' => ['nullable', 'numeric', 'between:0,999'],
            'action' => ['nullable', Rule::in(['warn', 'block', 'none'])],
        ]);

        $rule = BudgetControlRule::create([
            'company_id' => $this->companyId($request),
            'scope' => $validated['scope'] ?? 'global',
            'account_id' => isset($validated['account_id']) ? $this->accountId($request, $validated['account_id']) : null,
            'dimension_type' => $validated['dimension_type'] ?? null,
            'dimension_id' => $validated['dimension_id'] ?? null,
            'warn_threshold_pct' => $validated['warn_threshold_pct'] ?? 90,
            'block_threshold_pct' => $validated['block_threshold_pct'] ?? 100,
            'action' => $validated['action'] ?? 'warn',
            'is_active' => true,
        ]);

        return response()->json(['data' => ['id' => $rule->uuid, 'scope' => $rule->scope, 'action' => $rule->action]], 201);
    }

    /** @return array<string, mixed> */
    private function validateContext(Request $request, bool $withAmount = false): array
    {
        $rules = [
            'fiscal_year_id' => ['required', 'string'],
            'account_id' => ['required', 'string'],
            'dimension_type' => ['nullable', Rule::in(BudgetDimension::values())],
            'dimension_id' => ['nullable', 'string', 'max:64'],
            'period_number' => ['nullable', 'integer', 'between:1,12'],
        ];
        if ($withAmount) {
            $rules['amount'] = ['required', 'numeric', 'gt:0'];
        }

        return $request->validate($rules);
    }

    private function year(Request $request, string $uuid): FiscalYear
    {
        return FiscalYear::query()->where('company_id', $this->companyId($request))->where('uuid', $uuid)->firstOrFail();
    }
}
