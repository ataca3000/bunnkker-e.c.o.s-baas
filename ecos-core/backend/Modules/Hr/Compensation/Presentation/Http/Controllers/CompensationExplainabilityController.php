<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Hr\Compensation\Domain\Enums\AdjustmentComponent;
use Modules\Hr\Compensation\Domain\Models\Bonus;
use Modules\Hr\Compensation\Domain\Models\CommissionRule;
use Modules\Hr\Compensation\Domain\Models\CompensationAdjustment;
use Modules\Hr\Compensation\Domain\Models\PayrollPeriod;
use Modules\Hr\Compensation\Domain\Models\Payslip;
use Modules\Hr\Compensation\Domain\Services\BonusService;
use Modules\Hr\Compensation\Domain\Services\CommissionPreviewService;
use Modules\Hr\Compensation\Domain\Services\CommissionRuleService;
use Modules\Hr\Compensation\Domain\Services\CompensationAdjustmentService;
use Modules\Hr\Compensation\Domain\Services\CompensationLockService;
use Modules\Hr\Compensation\Domain\Services\KpiFactService;
use Modules\Hr\Compensation\Domain\Services\PayslipExplainerService;
use Modules\Hr\Workforce\Domain\Models\Employee;
use Modules\Hr\Workforce\Presentation\Http\Controllers\Concerns\ResolvesHrContext;

/**
 * Showing the working: previews, payslip explanations, KPI provenance,
 * post-approval adjustments and commission rule history.
 *
 * Everything except the adjustment writes is a GET.
 */
class CompensationExplainabilityController extends Controller
{
    use ResolvesHrContext;

    public function __construct(
        private readonly CommissionPreviewService $preview,
        private readonly PayslipExplainerService $explainer,
        private readonly KpiFactService $facts,
        private readonly CompensationAdjustmentService $adjustments,
        private readonly CompensationLockService $lock,
        private readonly CommissionRuleService $rules,
        private readonly BonusService $bonuses,
    ) {}

    // ── Commission preview (Part 6) ───────────────────────────────────────────

    public function commissionPreview(Request $request, string $periodId): JsonResponse
    {
        $period = $this->period($request, $periodId);

        return response()->json([
            'data' => $this->preview->forPeriod(
                $period,
                $request->query('employee_id') === null ? null : (string) $request->query('employee_id'),
            ),
        ]);
    }

    public function commissionDrillDown(Request $request, string $employeeId, string $ruleId): JsonResponse
    {
        $v = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date'],
        ]);

        return response()->json([
            'data' => $this->preview->drillDown(
                $this->employee($request, $employeeId),
                $ruleId,
                (string) $v['from'],
                (string) $v['to'],
            ),
        ]);
    }

    // ── Payslip explainability (Part 6) ───────────────────────────────────────

    public function explainPayslip(Request $request, string $payslipId): JsonResponse
    {
        $payslip = Payslip::query()
            ->where('company_id', $this->companyId($request))
            ->findOrFail($payslipId);

        return response()->json(['data' => $this->explainer->explain($payslip)]);
    }

    // ── KPI traceability (Part 6) ─────────────────────────────────────────────

    public function kpiTraceability(Request $request, string $employeeId): JsonResponse
    {
        $v = $request->validate([
            'metric_key' => ['required', 'string', 'max:60'],
            'from' => ['required', 'date'],
            'to' => ['required', 'date'],
        ]);

        return response()->json([
            'data' => $this->facts->traceability(
                $this->companyId($request),
                (string) $this->employee($request, $employeeId)->id,
                (string) $v['metric_key'],
                (string) $v['from'],
                (string) $v['to'],
            ),
        ]);
    }

    // ── Bonus decision audit (Part 6) ─────────────────────────────────────────

    public function bonusDecisionAudit(Request $request, string $bonusId): JsonResponse
    {
        $bonus = Bonus::query()
            ->where('company_id', $this->companyId($request))
            ->findOrFail($bonusId);

        return response()->json(['data' => $this->bonuses->decisionAudit($bonus)]);
    }

    // ── The lock (Part 7) ─────────────────────────────────────────────────────

    /** Is this date's pay already approved, and if so what should be done instead? */
    public function lockStatus(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->lock->explain(
                $this->companyId($request),
                $request->query('on_date') === null ? null : (string) $request->query('on_date'),
                $request->query('period_id') === null ? null : (string) $request->query('period_id'),
            ),
        ]);
    }

    // ── Adjustments (Part 7) ──────────────────────────────────────────────────

    public function pendingAdjustments(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->adjustments->pendingFor($this->companyId($request))]);
    }

    public function employeeAdjustments(Request $request, string $employeeId): JsonResponse
    {
        return response()->json([
            'data' => $this->adjustments->historyFor(
                $this->companyId($request),
                (string) $this->employee($request, $employeeId)->id,
            ),
        ]);
    }

    public function raiseAdjustment(Request $request, string $employeeId): JsonResponse
    {
        $v = $request->validate([
            'component' => ['required', 'in:bonus,commission,deduction,advance'],
            'amount' => ['required', 'numeric'],
            'reason' => ['required', 'string', 'max:500'],
            'currency' => ['nullable', 'string', 'size:3'],
            'notes' => ['nullable', 'string', 'max:4000'],
            'payroll_period_id' => ['nullable', 'string'],
            'original_period_id' => ['nullable', 'string'],
            'original_type' => ['nullable', 'string', 'max:40'],
            'original_id' => ['nullable', 'string', 'max:64'],
            'original_amount' => ['nullable', 'numeric'],
        ]);

        $adjustment = $this->adjustments->raise(
            $this->employee($request, $employeeId),
            AdjustmentComponent::from((string) $v['component']),
            $v,
            $this->actorId($request),
        );

        return response()->json(['data' => $adjustment->auditTrail()], 201);
    }

    public function approveAdjustment(Request $request, string $id): JsonResponse
    {
        $v = $request->validate(['note' => ['nullable', 'string', 'max:500']]);

        $adjustment = $this->adjustments->approve(
            $this->adjustment($request, $id), $this->actorId($request), $v['note'] ?? null
        );

        return response()->json(['data' => $adjustment->auditTrail()]);
    }

    public function rejectAdjustment(Request $request, string $id): JsonResponse
    {
        $v = $request->validate(['note' => ['nullable', 'string', 'max:500']]);

        $adjustment = $this->adjustments->reject(
            $this->adjustment($request, $id), $this->actorId($request), $v['note'] ?? null
        );

        return response()->json(['data' => $adjustment->auditTrail()]);
    }

    // ── Commission rule versions (Part 8) ─────────────────────────────────────

    public function ruleVersions(Request $request, string $ruleId): JsonResponse
    {
        return response()->json(['data' => $this->rules->versionHistory($this->rule($request, $ruleId))]);
    }

    public function ruleVersionOn(Request $request, string $ruleId): JsonResponse
    {
        $v = $request->validate(['date' => ['required', 'date']]);

        $version = $this->rules->versionInForceOn($this->rule($request, $ruleId), (string) $v['date']);

        return response()->json([
            'data' => $version === null ? null : [
                'id' => (string) $version->id,
                'version' => (int) $version->version,
                'rate' => (float) $version->rate,
                'method' => $version->method->value,
                'metric_key' => $version->metric_key,
                'effective_from' => $version->effective_from?->toDateString(),
                'effective_to' => $version->effective_to?->toDateString(),
            ],
        ]);
    }

    public function newRuleVersion(Request $request, string $ruleId): JsonResponse
    {
        $v = $request->validate([
            'effective_from' => ['required', 'date'],
            'rate' => ['nullable', 'numeric'],
            'metric_key' => ['nullable', 'string', 'max:60'],
            'method' => ['nullable', 'string', 'max:40'],
            'applies_to' => ['nullable', 'string', 'max:40'],
            'target_id' => ['nullable', 'string'],
            'threshold_value' => ['nullable', 'numeric'],
            'min_amount' => ['nullable', 'numeric'],
            'max_amount' => ['nullable', 'numeric'],
            'tiers' => ['nullable', 'array', 'max:20'],
            'name' => ['nullable', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        $successor = $this->rules->newVersion(
            $this->rule($request, $ruleId),
            $v,
            (string) $v['effective_from'],
        );

        return response()->json(['data' => $this->rules->versionHistory($successor)], 201);
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private function period(Request $request, string $id): PayrollPeriod
    {
        return PayrollPeriod::query()
            ->where('company_id', $this->companyId($request))
            ->findOrFail($id);
    }

    private function employee(Request $request, string $id): Employee
    {
        return Employee::query()
            ->where('company_id', $this->companyId($request))
            ->findOrFail($id);
    }

    private function adjustment(Request $request, string $id): CompensationAdjustment
    {
        return CompensationAdjustment::query()
            ->where('company_id', $this->companyId($request))
            ->findOrFail($id);
    }

    private function rule(Request $request, string $id): CommissionRule
    {
        return CommissionRule::query()
            ->where('company_id', $this->companyId($request))
            ->findOrFail($id);
    }
}
