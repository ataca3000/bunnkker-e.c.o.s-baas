<?php

declare(strict_types=1);

namespace Modules\Hr\Workforce\Domain\Enums;

/** The kind of employment contract signed. */
enum ContractType: string
{
    case Permanent = 'permanent';
    case FixedTerm = 'fixed_term';
    case Probation = 'probation';
    case Contractor = 'contractor';

    /** Whether an end date is required for this kind of contract. */
    public function requiresEndDate(): bool
    {
        return in_array($this, [self::FixedTerm, self::Probation, self::Contractor], true);
    }

    public function label(): string
    {
        return match ($this) {
            self::Permanent => 'Permanent',
            self::FixedTerm => 'Fixed Term',
            self::Probation => 'Probation',
            self::Contractor => 'Contractor',
        };
    }
}
