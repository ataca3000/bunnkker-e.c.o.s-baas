<?php

declare(strict_types=1);

namespace Modules\Hr\Attendance\Domain\Enums;

/**
 * The single instruction HR passes to Payroll about a period of leave.
 *
 * ┌─ HR STATES THE INTENT · PAYROLL DOES THE ARITHMETIC ────────────────────┐
 * │ Whether leave costs the employee salary is an HR decision, so HR records    │
 * │ it. How much, against which pay elements, in which period — none of that    │
 * │ is decided here. This flag is the entire contract between the two.          │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
enum LeavePayrollFlag: string
{
    case DeductSalary = 'deduct_salary';
    case DoNotDeductSalary = 'do_not_deduct_salary';

    public function deducts(): bool
    {
        return $this === self::DeductSalary;
    }

    public function label(): string
    {
        return match ($this) {
            self::DeductSalary => 'Deduct Salary',
            self::DoNotDeductSalary => 'Do Not Deduct Salary',
        };
    }
}
