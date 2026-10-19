<?php

declare(strict_types=1);

namespace Modules\Hr\Workforce\Domain\Enums;

/**
 * Where an employee stands with the company.
 *
 * The enum owns the transition map, so "can this person be terminated" is
 * answered in one place rather than re-decided at every call site.
 */
enum EmployeeStatus: string
{
    case Probation = 'probation';
    case Active = 'active';
    case OnLeave = 'on_leave';
    case Suspended = 'suspended';
    case Resigned = 'resigned';
    case Terminated = 'terminated';

    /** Still on the books — counts toward headcount and can be scheduled. */
    public function isEmployed(): bool
    {
        return ! in_array($this, [self::Resigned, self::Terminated], true);
    }

    /** Available for work today (on-leave and suspended staff are not). */
    public function isAvailable(): bool
    {
        return in_array($this, [self::Active, self::Probation], true);
    }

    /** @return array<int, self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Probation => [self::Active, self::OnLeave, self::Suspended, self::Resigned, self::Terminated],
            self::Active => [self::OnLeave, self::Suspended, self::Resigned, self::Terminated],
            self::OnLeave => [self::Active, self::Suspended, self::Resigned, self::Terminated],
            self::Suspended => [self::Active, self::Resigned, self::Terminated],
            // Leaving is final; a returning employee is rehired, not un-terminated.
            self::Resigned, self::Terminated => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    public function label(): string
    {
        return match ($this) {
            self::Probation => 'Probation',
            self::Active => 'Active',
            self::OnLeave => 'On Leave',
            self::Suspended => 'Suspended',
            self::Resigned => 'Resigned',
            self::Terminated => 'Terminated',
        };
    }
}
