<?php

declare(strict_types=1);

namespace Modules\Hr\Performance\Domain\Enums;

/** Whether a goal belongs to one person or to a whole department. */
enum GoalSubject: string
{
    case Employee = 'employee';
    case Department = 'department';

    /** The KPI-fact column facts are matched on for this subject. */
    public function factColumn(): string
    {
        return $this === self::Employee ? 'employee_id' : 'department_id';
    }

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
