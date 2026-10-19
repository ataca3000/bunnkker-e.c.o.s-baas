<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Enums;

/** Who a commission rule applies to. */
enum CommissionScope: string
{
    case Employee = 'employee';
    case Position = 'position';
    case Department = 'department';
    case JobGrade = 'job_grade';
    case All = 'all';

    /** The employee column a rule of this scope is matched against. */
    public function employeeColumn(): ?string
    {
        return match ($this) {
            self::Employee => 'id',
            self::Position => 'position_id',
            self::Department => 'department_id',
            self::JobGrade => 'job_grade_id',
            self::All => null,
        };
    }

    /** More specific scopes win when several rules match the same metric. */
    public function specificity(): int
    {
        return match ($this) {
            self::Employee => 40,
            self::Position => 30,
            self::JobGrade => 20,
            self::Department => 10,
            self::All => 0,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Employee => 'Employee',
            self::Position => 'Position',
            self::Department => 'Department',
            self::JobGrade => 'Job Grade',
            self::All => 'All Employees',
        };
    }
}
