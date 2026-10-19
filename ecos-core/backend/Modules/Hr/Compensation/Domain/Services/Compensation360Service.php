<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Hr\Compensation\Domain\Enums\ApprovalStatus;
use Modules\Hr\Compensation\Domain\Models\Advance;
use Modules\Hr\Compensation\Domain\Models\Bonus;
use Modules\Hr\Compensation\Domain\Models\Deduction;
use Modules\Hr\Compensation\Domain\Models\Payslip;
use Modules\Hr\Workforce\Domain\Models\Employee;

/**
 * Compensation 360 — everything about one person's pay, on one page.
 *
 * The current salary, what they are earning in commission, what is owed and being
 * recovered, what has been deducted and why, and the payslip history. Assembled
 * on read; nothing here is stored.
 */
final class Compensation360Service
{
    public function __construct(
        private readonly SalaryStructureService $salaries,
        private readonly CommissionEngine $commissions,
        private readonly AdvanceService $advances,
    ) {}

    /** @return array<string, mixed> */
    public function build(Employee $employee, int $months = 6): array
    {
        $current = $this->salaries->current($employee);
        $to = Carbon::now();
        $from = $to->copy()->subMonthsNoOverflow($months - 1)->startOfMonth();

        $payslips = Payslip::query()
            ->with('period:id,code,name')
            ->where('employee_id', $employee->id)
            ->orderByDesc('created_at')
            ->limit($months)
            ->get();

        return [
            'employee' => [
                'id' => (string) $employee->id,
                'employee_number' => $employee->employee_number,
                'name' => $employee->fullName(),
                'status' => $employee->status->value,
            ],
            'salary' => [
                'basic_salary' => $current === null ? 0.0 : round((float) $current->basic_salary, 2),
                'currency' => $current->currency ?? 'EGP',
                'pay_frequency' => $current->pay_frequency ?? null,
                'effective_from' => $current?->effective_from?->toDateString(),
                'history' => $this->salaries->history($employee)->map(fn ($s) => [
                    'id' => (string) $s->id,
                    'basic_salary' => round((float) $s->basic_salary, 2),
                    'effective_from' => $s->effective_from?->toDateString(),
                    'effective_to' => $s->effective_to?->toDateString(),
                ])->all(),
            ],
            // What the rules would pay on this month's facts so far.
            'commission' => [
                'rules' => array_map(fn ($rule) => [
                    'code' => $rule->code,
                    'name' => $rule->name,
                    'metric_key' => $rule->metric_key,
                    'method' => $rule->method->value,
                    'rate' => (float) $rule->rate,
                ], $this->commissions->rulesFor($employee, $to->toDateString())),
                'month_to_date' => $this->commissions->calculate(
                    $employee, $to->copy()->startOfMonth()->toDateString(), $to->toDateString()
                ),
            ],
            'advances' => $this->advances->balanceFor($employee) + [
                'open' => Advance::query()
                    ->with('installments')
                    ->where('employee_id', $employee->id)
                    ->whereIn('status', ['approved', 'active'])
                    ->get()->map(fn (Advance $a) => [
                        'id' => (string) $a->id,
                        'reference' => $a->reference,
                        'type' => $a->type->value,
                        'amount' => round((float) $a->amount, 2),
                        'remaining_balance' => $a->remainingBalance(),
                        'installments_count' => $a->installments_count,
                        'schedule' => $a->installments->map(fn ($i) => [
                            'sequence' => $i->sequence,
                            'amount' => round((float) $i->amount, 2),
                            'due_date' => $i->due_date?->toDateString(),
                            'status' => $i->status->value,
                        ])->all(),
                    ])->all(),
            ],
            'bonuses' => Bonus::query()
                ->where('employee_id', $employee->id)
                ->where('awarded_on', '>=', $from->toDateString())
                ->orderByDesc('awarded_on')->get()
                ->map(fn (Bonus $b) => [
                    'id' => (string) $b->id,
                    'type' => $b->type->value,
                    'amount' => round((float) $b->amount, 2),
                    'reason' => $b->reason,
                    'status' => $b->status->value,
                    'awarded_on' => $b->awarded_on?->toDateString(),
                    'source' => $b->source,
                ])->all(),
            'deductions' => Deduction::query()
                ->where('employee_id', $employee->id)
                ->where('deduction_date', '>=', $from->toDateString())
                ->orderByDesc('deduction_date')->get()
                ->map(fn (Deduction $d) => [
                    'id' => (string) $d->id,
                    'type' => $d->type->value,
                    'type_label' => $d->type->label(),
                    'amount' => round((float) $d->amount, 2),
                    'reason' => $d->reason,
                    'decision' => $d->decision,
                    'status' => $d->status->value,
                    'deduction_date' => $d->deduction_date?->toDateString(),
                    'source_module' => $d->source_module,
                    'source_reference' => $d->source_reference,
                ])->all(),
            'pending_approvals' => [
                'bonuses' => Bonus::query()->where('employee_id', $employee->id)
                    ->where('status', ApprovalStatus::Pending->value)->count(),
                'deductions' => Deduction::query()->where('employee_id', $employee->id)
                    ->where('status', ApprovalStatus::Pending->value)->count(),
            ],
            'payslips' => $payslips->map(fn (Payslip $p) => [
                'id' => (string) $p->id,
                'payslip_number' => $p->payslip_number,
                'period' => $p->period?->code,
                'basic_salary' => round((float) $p->basic_salary, 2),
                'bonus_total' => round((float) $p->bonus_total, 2),
                'commission_total' => round((float) $p->commission_total, 2),
                'advance_total' => round((float) $p->advance_total, 2),
                'deduction_total' => round((float) $p->deduction_total, 2),
                'gross_salary' => round((float) $p->gross_salary, 2),
                'net_salary' => round((float) $p->net_salary, 2),
                'status' => $p->status,
            ])->all(),
        ];
    }
}
