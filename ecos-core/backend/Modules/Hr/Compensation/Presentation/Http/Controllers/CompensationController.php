<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Hr\Compensation\Domain\Models\Advance;
use Modules\Hr\Compensation\Domain\Models\Bonus;
use Modules\Hr\Compensation\Domain\Models\Deduction;
use Modules\Hr\Compensation\Domain\Services\AdvanceService;
use Modules\Hr\Compensation\Domain\Services\BonusService;
use Modules\Hr\Compensation\Domain\Services\Compensation360Service;
use Modules\Hr\Compensation\Domain\Services\DeductionService;
use Modules\Hr\Compensation\Domain\Services\SalaryStructureService;
use Modules\Hr\Workforce\Presentation\Http\Controllers\Concerns\ResolvesHrContext;

/** Salary structures, bonuses, deductions, advances and Compensation 360. */
class CompensationController extends Controller
{
    use ResolvesHrContext;

    public function __construct(
        private readonly SalaryStructureService $salaries,
        private readonly BonusService $bonuses,
        private readonly DeductionService $deductions,
        private readonly AdvanceService $advances,
        private readonly Compensation360Service $overview,
    ) {}

    /** Compensation 360 for one employee. */
    public function overview(Request $request, string $employeeId): JsonResponse
    {
        return response()->json(['data' => $this->overview->build($this->employee($request, $employeeId))]);
    }

    // ── Salary ────────────────────────────────────────────────────────────────

    public function assignSalary(Request $request, string $employeeId): JsonResponse
    {
        $v = $request->validate([
            'basic_salary' => ['required', 'numeric', 'min:0.01'],
            'currency' => ['nullable', 'string', 'size:3'],
            'pay_frequency' => ['nullable', 'in:monthly,weekly,daily'],
            'effective_from' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:400'],
        ]);

        $structure = $this->salaries->assign(
            $this->employee($request, $employeeId), (float) $v['basic_salary'], $v, $this->actorId($request)
        );

        return response()->json(['data' => $structure], 201);
    }

    // ── Bonuses ───────────────────────────────────────────────────────────────

    public function bonuses(Request $request): JsonResponse
    {
        $rows = Bonus::query()
            ->with('employee:id,first_name,last_name,employee_number')
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('employee_id'), fn ($q) => $q->where('employee_id', $request->string('employee_id')))
            ->orderByDesc('awarded_on')->limit(200)->get()
            ->map(fn (Bonus $b) => $this->bonusPayload($b));

        return response()->json(['data' => $rows]);
    }

    public function storeBonus(Request $request): JsonResponse
    {
        $v = $request->validate([
            'employee_id' => ['required', 'string'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'reason' => ['required', 'string', 'max:400'],
            'type' => ['nullable', 'string'],
            'payroll_period_id' => ['nullable', 'string'],
            'awarded_on' => ['nullable', 'date'],
        ]);

        $bonus = $this->bonuses->award($this->employee($request, $v['employee_id']), $v, $this->actorId($request));

        return response()->json(['data' => $this->bonusPayload($bonus)], 201);
    }

    public function decideBonus(Request $request, string $id): JsonResponse
    {
        $v = $request->validate(['decision' => ['required', 'in:approve,reject']]);

        $bonus = Bonus::query()
            ->where('company_id', $this->companyId($request))->where('id', $id)->firstOrFail();

        $bonus = $v['decision'] === 'approve'
            ? $this->bonuses->approve($bonus, $this->actorId($request))
            : $this->bonuses->reject($bonus, $this->actorId($request));

        return response()->json(['data' => $this->bonusPayload($bonus)]);
    }

    // ── Deductions ────────────────────────────────────────────────────────────

    public function deductions(Request $request): JsonResponse
    {
        $rows = Deduction::query()
            ->with('employee:id,first_name,last_name,employee_number')
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->string('type')))
            ->when($request->filled('employee_id'), fn ($q) => $q->where('employee_id', $request->string('employee_id')))
            ->orderByDesc('deduction_date')->limit(200)->get()
            ->map(fn (Deduction $d) => $this->deductionPayload($d));

        return response()->json(['data' => $rows]);
    }

    public function storeDeduction(Request $request): JsonResponse
    {
        $v = $request->validate([
            'employee_id' => ['required', 'string'],
            'type' => ['required', 'string'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'reason' => ['required', 'string', 'max:400'],
            'decision' => ['nullable', 'string', 'max:400'],
            'deduction_date' => ['nullable', 'date'],
            'payroll_period_id' => ['nullable', 'string'],
            'source_module' => ['nullable', 'string', 'max:40'],
            'source_reference' => ['nullable', 'string', 'max:64'],
            'notes' => ['nullable', 'string'],
        ]);

        $deduction = $this->deductions->raise($this->employee($request, $v['employee_id']), $v, $this->actorId($request));

        return response()->json(['data' => $this->deductionPayload($deduction)], 201);
    }

    public function decideDeduction(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'decision' => ['required', 'in:approve,reject'],
            'note' => ['nullable', 'string', 'max:400'],
        ]);

        $deduction = Deduction::query()
            ->where('company_id', $this->companyId($request))->where('id', $id)->firstOrFail();

        $deduction = $v['decision'] === 'approve'
            ? $this->deductions->approve($deduction, $this->actorId($request), $v['note'] ?? null)
            : $this->deductions->reject($deduction, $this->actorId($request), $v['note'] ?? null);

        return response()->json(['data' => $this->deductionPayload($deduction)]);
    }

    // ── Advances ──────────────────────────────────────────────────────────────

    public function advances(Request $request): JsonResponse
    {
        $rows = Advance::query()
            ->with(['employee:id,first_name,last_name,employee_number', 'installments'])
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('employee_id'), fn ($q) => $q->where('employee_id', $request->string('employee_id')))
            ->orderByDesc('requested_on')->limit(200)->get()
            ->map(fn (Advance $a) => $this->advancePayload($a));

        return response()->json(['data' => $rows]);
    }

    public function storeAdvance(Request $request): JsonResponse
    {
        $v = $request->validate([
            'employee_id' => ['required', 'string'],
            'type' => ['required', 'in:one_time,installment'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'installments_count' => ['nullable', 'integer', 'min:1', 'max:60'],
            'first_recovery_date' => ['nullable', 'date'],
            'reason' => ['nullable', 'string', 'max:400'],
        ]);

        $advance = $this->advances->request($this->employee($request, $v['employee_id']), $v, $this->actorId($request));

        return response()->json(['data' => $this->advancePayload($advance)], 201);
    }

    public function decideAdvance(Request $request, string $id): JsonResponse
    {
        $v = $request->validate(['decision' => ['required', 'in:approve,cancel']]);

        $advance = Advance::query()
            ->where('company_id', $this->companyId($request))->where('id', $id)->firstOrFail();

        $advance = $v['decision'] === 'approve'
            ? $this->advances->approve($advance, $this->actorId($request))
            : $this->advances->cancel($advance);

        return response()->json(['data' => $this->advancePayload($advance->refresh())]);
    }

    // ── Payloads ──────────────────────────────────────────────────────────────

    /** @return array<string, mixed> */
    private function bonusPayload(Bonus $bonus): array
    {
        return [
            'id' => (string) $bonus->id,
            'employee' => $this->employeeRef($bonus->employee),
            'type' => $bonus->type->value,
            'type_label' => $bonus->type->label(),
            'amount' => round((float) $bonus->amount, 2),
            'currency' => $bonus->currency,
            'reason' => $bonus->reason,
            'status' => $bonus->status->value,
            'source' => $bonus->source,
            'awarded_on' => $bonus->awarded_on?->toDateString(),
        ];
    }

    /** @return array<string, mixed> */
    private function deductionPayload(Deduction $deduction): array
    {
        return [
            'id' => (string) $deduction->id,
            'employee' => $this->employeeRef($deduction->employee),
            'type' => $deduction->type->value,
            'type_label' => $deduction->type->label(),
            'amount' => round((float) $deduction->amount, 2),
            'currency' => $deduction->currency,
            'reason' => $deduction->reason,
            'decision' => $deduction->decision,
            'status' => $deduction->status->value,
            'approver_id' => $deduction->approver_id,
            'decided_at' => $deduction->decided_at?->toDateTimeString(),
            'deduction_date' => $deduction->deduction_date?->toDateString(),
            'source_module' => $deduction->source_module,
            'source_reference' => $deduction->source_reference,
            'notes' => $deduction->notes,
        ];
    }

    /** @return array<string, mixed> */
    private function advancePayload(Advance $advance): array
    {
        return [
            'id' => (string) $advance->id,
            'reference' => $advance->reference,
            'employee' => $this->employeeRef($advance->employee),
            'type' => $advance->type->value,
            'type_label' => $advance->type->label(),
            'amount' => round((float) $advance->amount, 2),
            'currency' => $advance->currency,
            'installments_count' => $advance->installments_count,
            'installment_amount' => round((float) $advance->installment_amount, 2),
            'remaining_balance' => $advance->remainingBalance(),
            'recovered_amount' => $advance->recoveredAmount(),
            'status' => $advance->status->value,
            'requested_on' => $advance->requested_on?->toDateString(),
            'schedule' => $advance->installments->map(fn ($i) => [
                'id' => (string) $i->id,
                'sequence' => $i->sequence,
                'amount' => round((float) $i->amount, 2),
                'due_date' => $i->due_date?->toDateString(),
                'status' => $i->status->value,
            ])->all(),
        ];
    }

    /** @return array<string, mixed>|null */
    private function employeeRef(mixed $employee): ?array
    {
        return $employee === null ? null : [
            'id' => (string) $employee->id,
            'name' => $employee->fullName(),
            'employee_number' => $employee->employee_number,
        ];
    }
}
