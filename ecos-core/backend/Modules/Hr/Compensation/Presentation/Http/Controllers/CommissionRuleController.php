<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Hr\Compensation\Domain\Models\CommissionRule;
use Modules\Hr\Compensation\Domain\Services\CommissionEngine;
use Modules\Hr\Compensation\Domain\Services\CommissionRuleService;
use Modules\Hr\Workforce\Presentation\Http\Controllers\Concerns\ResolvesHrContext;

/** The commission rules engine — configuration, and a preview of what it would pay. */
class CommissionRuleController extends Controller
{
    use ResolvesHrContext;

    public function __construct(
        private readonly CommissionRuleService $rules,
        private readonly CommissionEngine $engine,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $rows = $this->rules->forCompany($this->companyId($request))
            ->map(fn (CommissionRule $r) => $this->payload($r));

        return response()->json(['data' => $rows]);
    }

    /** The metrics a rule can be written against. */
    public function metrics(): JsonResponse
    {
        return response()->json(['data' => $this->rules->availableMetrics()]);
    }

    public function store(Request $request): JsonResponse
    {
        $v = $request->validate($this->validationRules());

        return response()->json(['data' => $this->payload($this->rules->create($this->companyId($request), $v))], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $v = $request->validate($this->validationRules(updating: true));

        $rule = CommissionRule::query()
            ->where('company_id', $this->companyId($request))->where('id', $id)->firstOrFail();

        return response()->json(['data' => $this->payload($this->rules->update($rule, $v))]);
    }

    /**
     * What the configured rules would pay one employee over a window — the way to
     * check a scheme does what was intended before anyone is paid by it.
     */
    public function preview(Request $request, string $employeeId): JsonResponse
    {
        $v = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
        ]);

        $employee = $this->employee($request, $employeeId);
        $earned = $this->engine->calculate($employee, $v['from'], $v['to']);

        return response()->json([
            'data' => [
                'employee_id' => (string) $employee->id,
                'from' => $v['from'],
                'to' => $v['to'],
                'total' => round(array_sum(array_column($earned, 'amount')), 2),
                'rules' => $earned,
            ],
        ]);
    }

    /** @return array<string, mixed> */
    private function validationRules(bool $updating = false): array
    {
        $required = $updating ? 'sometimes' : 'required';

        return [
            'code' => [$required, 'string', 'max:40'],
            'name' => [$required, 'string', 'max:150'],
            'metric_key' => [$required, 'string', 'max:60'],
            'method' => [$required, 'in:percentage_of_value,amount_per_unit,tiered'],
            'rate' => ['nullable', 'numeric', 'min:0'],
            'applies_to' => ['nullable', 'in:employee,position,department,job_grade,all'],
            'target_id' => ['nullable', 'string'],
            'dimension_key' => ['nullable', 'string', 'max:40'],
            'dimension_value' => ['nullable', 'string', 'max:64'],
            'min_amount' => ['nullable', 'numeric', 'min:0'],
            'max_amount' => ['nullable', 'numeric', 'min:0'],
            'threshold_value' => ['nullable', 'numeric', 'min:0'],
            'effective_from' => ['nullable', 'date'],
            'effective_to' => ['nullable', 'date'],
            'priority' => ['nullable', 'integer', 'min:1', 'max:999'],
            'is_active' => ['nullable', 'boolean'],
            'description' => ['nullable', 'string', 'max:400'],
            'tiers' => ['nullable', 'array'],
            'tiers.*.from_value' => ['required_with:tiers', 'numeric', 'min:0'],
            'tiers.*.to_value' => ['nullable', 'numeric'],
            'tiers.*.rate' => ['required_with:tiers', 'numeric', 'min:0'],
        ];
    }

    /** @return array<string, mixed> */
    private function payload(CommissionRule $rule): array
    {
        return [
            'id' => (string) $rule->id,
            'code' => $rule->code,
            'name' => $rule->name,
            'description' => $rule->description,
            'metric_key' => $rule->metric_key,
            'method' => $rule->method->value,
            'method_label' => $rule->method->label(),
            'reads' => $rule->method->reads(),
            'rate' => (float) $rule->rate,
            'applies_to' => $rule->applies_to->value,
            'applies_to_label' => $rule->applies_to->label(),
            'target_id' => $rule->target_id,
            'dimension_key' => $rule->dimension_key,
            'dimension_value' => $rule->dimension_value,
            'min_amount' => $rule->min_amount === null ? null : (float) $rule->min_amount,
            'max_amount' => $rule->max_amount === null ? null : (float) $rule->max_amount,
            'threshold_value' => $rule->threshold_value === null ? null : (float) $rule->threshold_value,
            'effective_from' => $rule->effective_from?->toDateString(),
            'effective_to' => $rule->effective_to?->toDateString(),
            'priority' => $rule->priority,
            'is_active' => $rule->is_active,
            'tiers' => $rule->tiers->map(fn ($t) => [
                'sequence' => $t->sequence,
                'from_value' => (float) $t->from_value,
                'to_value' => $t->to_value === null ? null : (float) $t->to_value,
                'rate' => (float) $t->rate,
            ])->all(),
        ];
    }
}
