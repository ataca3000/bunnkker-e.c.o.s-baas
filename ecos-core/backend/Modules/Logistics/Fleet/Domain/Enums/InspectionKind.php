<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Enums;

enum InspectionKind: string
{
    case PreTrip = 'pre_trip';
    case PostTrip = 'post_trip';
    case Periodic = 'periodic';
    case Statutory = 'statutory';
    case Incident = 'incident';

    public function label(): string
    {
        return match ($this) {
            self::PreTrip => 'Pre-Trip',
            self::PostTrip => 'Post-Trip',
            self::Periodic => 'Periodic',
            self::Statutory => 'Statutory',
            self::Incident => 'Incident',
        };
    }

    /**
     * Kinds whose lapse makes a vehicle unfit. A missed post-trip check is
     * untidy; a lapsed statutory inspection is illegal.
     */
    public function isMandatory(): bool
    {
        return in_array($this, [self::PreTrip, self::Periodic, self::Statutory], true);
    }

    /** Statutory lapses have no grace period. */
    public function graceDays(): int
    {
        return match ($this) {
            self::Statutory => 0,
            self::Periodic => 3,
            self::PreTrip => 0,
            self::PostTrip, self::Incident => 7,
        };
    }

    /** Default cadence in days; null means "not scheduled, raised on demand". */
    public function defaultIntervalDays(): ?int
    {
        return match ($this) {
            self::PreTrip => 1,
            self::PostTrip => 1,
            self::Periodic => 30,
            self::Statutory => 365,
            self::Incident => null,
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }

    /** @return list<array{value: string, label: string, is_mandatory: bool}> */
    public static function options(): array
    {
        return array_map(
            static fn (self $c) => [
                'value' => $c->value,
                'label' => $c->label(),
                'is_mandatory' => $c->isMandatory(),
            ],
            self::cases(),
        );
    }
}
