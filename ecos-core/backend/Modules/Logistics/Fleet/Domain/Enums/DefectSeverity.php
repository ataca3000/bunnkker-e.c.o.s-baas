<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Enums;

/**
 * How badly a fault affects roadworthiness.
 *
 * Only `critical` blocks fitness. The distinction lives here rather than in the
 * readiness service so a checklist item's severity decides the consequence.
 */
enum DefectSeverity: string
{
    case Minor = 'minor';
    case Major = 'major';
    case Critical = 'critical';

    public function label(): string
    {
        return match ($this) {
            self::Minor => 'Minor',
            self::Major => 'Major',
            self::Critical => 'Critical',
        };
    }

    /** BR-F3: an open critical defect makes a vehicle unfit, immediately. */
    public function blocksFitness(): bool
    {
        return $this === self::Critical;
    }

    /** Majors are advisory but must be visible on the fitness verdict. */
    public function warnsFitness(): bool
    {
        return $this === self::Major;
    }

    public function weight(): int
    {
        return match ($this) {
            self::Minor => 1,
            self::Major => 5,
            self::Critical => 20,
        };
    }

    public function tone(): string
    {
        return match ($this) {
            self::Minor => 'neutral',
            self::Major => 'warning',
            self::Critical => 'danger',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }

    /** @return list<array{value: string, label: string}> */
    public static function options(): array
    {
        return array_map(
            static fn (self $c) => ['value' => $c->value, 'label' => $c->label()],
            self::cases(),
        );
    }
}
