<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Modules\Finance\Budget\Domain\Enums\BudgetDimension;
use Modules\Finance\Budget\Domain\Models\Budget;
use Modules\Finance\Budget\Domain\Services\BudgetControlEngine;
use Modules\Finance\Budget\Domain\Services\BudgetService;
use Modules\Finance\Fiscal\Domain\Models\FiscalYear;
use Modules\Finance\Presentation\Http\Controllers\Concerns\ResolvesFinanceContext;

/**
 * Budget authoring: versions, scenarios, lines, the draft → approved workflow,
 * and budget-vs-actual. Budgets never affect the ledger.
 */
class BudgetController extends Controller
{
    use ResolvesFinanceContext;

    public function __construct(
        private readonly BudgetService $budgets,
        private readonly BudgetControlEngine $control,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $budgets = Budget::query()
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->latest('id')->limit(100)->get()
            ->map(fn (Budget $b) => $this->payload($b));

        return response()->json(['data' => $budgets]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'fiscal_year_id' => ['required', 'string'], // uuid
            'name' => ['required', 'string', 'max:200'],
            'version' => ['nullable', 'string', 'max:40'],
            'scenario' => ['nullable', 'string', 'max:40'],
            'currency' => ['nullable', 'string', 'size:3'],
            'description' => ['nullable', 'string', 'max:500'],
        ]);

        $budget = $this->budgets->create(
            companyId: $this->companyId($request),
            fiscalYearId: (int) $this->year($request, $validated['fiscal_year_id'])->id,
            name: $validated['name'],
            version: $validated['version'] ?? 'v1',
            scenario: $validated['scenario'] ?? 'base',
            currency: $validated['currency'] ?? 'EGP',
            description: $validated['description'] ?? null,
            createdBy: $this->actorId($request),
        );

        return response()->json(['data' => $this->payload($budget)], 201);
    }

    public function addLine(Request $request, string $uuid): JsonResponse
    {
        $validated = $request->validate([
            'account_id' => ['required', 'string'], // uuid
            'amount' => ['required', 'numeric'],
            'dimension_type' => ['nullable', Rule::in(BudgetDimension::values())],
            'dimension_id' => ['nullable', 'string', 'max:64'],
            'period_number' => ['nullable', 'integer', 'between:1,12'],
            'notes' => ['nullable', 'string', 'max:300'],
        ]);

        $budget = $this->find($request, $uuid);
        $line = $this->budgets->addLine(
            budget: $budget,
            accountId: $this->accountId($request, $validated['account_id']),
            amount: (float) $validated['amount'],
            dimension: BudgetDimension::from($validated['dimension_type'] ?? 'company'),
            dimensionId: $validated['dimension_id'] ?? null,
            periodNumber: $validated['period_number'] ?? null,
            notes: $validated['notes'] ?? null,
        );

        return response()->json(['data' => ['id' => $line->uuid, 'amount' => (float) $line->amount]], 201);
    }

    public function approve(Request $request, string $uuid): JsonResponse
    {
        $budget = $this->budgets->approve($this->find($request, $uuid), (int) $this->actorId($request));

        return response()->json(['data' => $this->payload($budget)]);
    }

    public function newVersion(Request $request, string $uuid): JsonResponse
    {
        $validated = $request->validate(['version' => ['required', 'string', 'max:40']]);
        $clone = $this->budgets->cloneAsVersion($this->find($request, $uuid), $validated['version'], $this->actorId($request));

        return response()->json(['data' => $this->payload($clone)], 201);
    }

    public function vsActual(Request $request, string $uuid): JsonResponse
    {
        return response()->json(['data' => $this->control->budgetVsActual($this->find($request, $uuid))]);
    }

    public function alerts(Request $request, string $uuid): JsonResponse
    {
        return response()->json(['data' => $this->control->alerts($this->find($request, $uuid))]);
    }

    private function find(Request $request, string $uuid): Budget
    {
        return Budget::query()->where('company_id', $this->companyId($request))->where('uuid', $uuid)->firstOrFail();
    }

    private function year(Request $request, string $uuid): FiscalYear
    {
        return FiscalYear::query()->where('company_id', $this->companyId($request))->where('uuid', $uuid)->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function payload(Budget $b): array
    {
        return [
            'id' => $b->uuid,
            'name' => $b->name,
            'version' => $b->version,
            'scenario' => $b->scenario,
            'status' => $b->status->value,
            'currency' => $b->currency,
            'total' => $b->total(),
            'approved_at' => $b->approved_at?->toIso8601String(),
        ];
    }
}
