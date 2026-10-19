<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Hr\Compensation\Domain\Models\PayrollPeriod;
use Modules\Hr\Compensation\Domain\Models\PayrollRun;
use Modules\Hr\Compensation\Domain\Models\Payslip;
use Modules\Hr\Compensation\Domain\Services\CompensationCalculator;
use Modules\Hr\Compensation\Domain\Services\PayrollRunService;
use Modules\Hr\Workforce\Presentation\Http\Controllers\Concerns\ResolvesHrContext;

/** Payroll periods, runs, payslips and approval. */
class PayrollController extends Controller
{
    use ResolvesHrContext;

    public function __construct(
        private readonly PayrollRunService $payroll,
        private readonly CompensationCalculator $calculator,
    ) {}

    public function periods(Request $request): JsonResponse
    {
        $rows = PayrollPeriod::query()
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->orderByDesc('start_date')
            ->limit(60)->get()
            ->map(fn (PayrollPeriod $p) => $this->periodPayload($p));

        return response()->json(['data' => $rows]);
    }

    public function storePeriod(Request $request): JsonResponse
    {
        $v = $request->validate([
            'code' => ['nullable', 'string', 'max:30'],
            'name' => ['nullable', 'string', 'max:120'],
            'start_date' => ['required', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'payment_date' => ['nullable', 'date'],
            'currency' => ['nullable', 'string', 'size:3'],
        ]);

        return response()->json(['data' => $this->periodPayload($this->payroll->createPeriod($this->companyId($request), $v))], 201);
    }

    public function openPeriod(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => $this->periodPayload($this->payroll->openPeriod($this->period($request, $id)))]);
    }

    public function closePeriod(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => $this->periodPayload($this->payroll->closePeriod($this->period($request, $id)))]);
    }

    /** Calculate the whole period — safe to repeat until it is approved. */
    public function calculate(Request $request, string $id): JsonResponse
    {
        $run = $this->payroll->calculate($this->period($request, $id), $this->actorId($request));

        return response()->json(['data' => $this->runPayload($run)]);
    }

    /** Approve — freezes the payslips and announces the totals for Finance. */
    public function approveRun(Request $request, string $runId): JsonResponse
    {
        $run = PayrollRun::query()
            ->where('company_id', $this->companyId($request))->where('id', $runId)->firstOrFail();

        return response()->json(['data' => $this->runPayload($this->payroll->approve($run, $this->actorId($request)))]);
    }

    public function runs(Request $request): JsonResponse
    {
        $rows = PayrollRun::query()
            ->with('period:id,code,name')
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('period_id'), fn ($q) => $q->where('payroll_period_id', $request->string('period_id')))
            ->orderByDesc('created_at')->limit(50)->get()
            ->map(fn (PayrollRun $r) => $this->runPayload($r));

        return response()->json(['data' => $rows]);
    }

    public function payslips(Request $request): JsonResponse
    {
        $rows = Payslip::query()
            ->with(['employee:id,first_name,last_name,employee_number', 'period:id,code'])
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('run_id'), fn ($q) => $q->where('payroll_run_id', $request->string('run_id')))
            ->when($request->filled('period_id'), fn ($q) => $q->where('payroll_period_id', $request->string('period_id')))
            ->when($request->filled('employee_id'), fn ($q) => $q->where('employee_id', $request->string('employee_id')))
            ->orderByDesc('created_at')->limit(500)->get()
            ->map(fn (Payslip $p) => $this->payslipPayload($p));

        return response()->json(['data' => $rows]);
    }

    /** One payslip with its itemised lines and stored explanation. */
    public function payslip(Request $request, string $id): JsonResponse
    {
        $payslip = Payslip::query()
            ->with(['employee:id,first_name,last_name,employee_number', 'period:id,code,name', 'lines'])
            ->where('company_id', $this->companyId($request))
            ->where('id', $id)->firstOrFail();

        return response()->json([
            'data' => $this->payslipPayload($payslip) + [
                'explanation' => $payslip->explanation,
                'lines' => $payslip->lines->map(fn ($line) => [
                    'category' => $line->category,
                    'code' => $line->code,
                    'label' => $line->label,
                    'amount' => round((float) $line->amount, 2),
                    'sign' => $line->sign,
                    'signed_amount' => $line->signedAmount(),
                    'source_type' => $line->source_type,
                    'source_id' => $line->source_id,
                    'explanation' => $line->explanation,
                ])->all(),
                // A cheap invariant: the stored components still add up.
                'recomputed_net' => $payslip->recomputedNet(),
            ],
        ]);
    }

    /** What attendance would justify deducting — a suggestion, never applied. */
    public function attendanceSuggestions(Request $request, string $id, string $employeeId): JsonResponse
    {
        $period = $this->period($request, $id);
        $employee = $this->employee($request, $employeeId);

        return response()->json(['data' => $this->calculator->suggestedAttendanceDeductions($employee, $period)]);
    }

    // ── Payloads ──────────────────────────────────────────────────────────────

    private function period(Request $request, string $id): PayrollPeriod
    {
        return PayrollPeriod::query()
            ->where('company_id', $this->companyId($request))->where('id', $id)->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function periodPayload(PayrollPeriod $period): array
    {
        return [
            'id' => (string) $period->id,
            'code' => $period->code,
            'name' => $period->name,
            'start_date' => $period->start_date?->toDateString(),
            'end_date' => $period->end_date?->toDateString(),
            'payment_date' => $period->payment_date?->toDateString(),
            'status' => $period->status->value,
            'status_label' => $period->status->label(),
            'currency' => $period->currency,
            'is_final' => $period->isFinal(),
            'accepts_adjustments' => $period->status->acceptsAdjustments(),
            'calculated_at' => $period->calculated_at?->toDateTimeString(),
            'approved_at' => $period->approved_at?->toDateTimeString(),
        ];
    }

    /** @return array<string, mixed> */
    private function runPayload(PayrollRun $run): array
    {
        return [
            'id' => (string) $run->id,
            'reference' => $run->reference,
            'period' => $run->period?->only(['id', 'code', 'name']),
            'payroll_period_id' => (string) $run->payroll_period_id,
            'status' => $run->status->value,
            'employees_count' => $run->employees_count,
            'total_basic' => round((float) $run->total_basic, 2),
            'total_bonus' => round((float) $run->total_bonus, 2),
            'total_commission' => round((float) $run->total_commission, 2),
            'total_advances' => round((float) $run->total_advances, 2),
            'total_deductions' => round((float) $run->total_deductions, 2),
            'total_gross' => round((float) $run->total_gross, 2),
            'total_net' => round((float) $run->total_net, 2),
            'currency' => $run->currency,
            'calculated_at' => $run->calculated_at?->toDateTimeString(),
            'approved_at' => $run->approved_at?->toDateTimeString(),
        ];
    }

    /** @return array<string, mixed> */
    private function payslipPayload(Payslip $payslip): array
    {
        return [
            'id' => (string) $payslip->id,
            'payslip_number' => $payslip->payslip_number,
            'employee' => $payslip->employee === null ? null : [
                'id' => (string) $payslip->employee->id,
                'name' => $payslip->employee->fullName(),
                'employee_number' => $payslip->employee->employee_number,
            ],
            'period' => $payslip->period?->code,
            'basic_salary' => round((float) $payslip->basic_salary, 2),
            'bonus_total' => round((float) $payslip->bonus_total, 2),
            'commission_total' => round((float) $payslip->commission_total, 2),
            'advance_total' => round((float) $payslip->advance_total, 2),
            'deduction_total' => round((float) $payslip->deduction_total, 2),
            'gross_salary' => round((float) $payslip->gross_salary, 2),
            'net_salary' => round((float) $payslip->net_salary, 2),
            'currency' => $payslip->currency,
            'status' => $payslip->status,
        ];
    }
}
