<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Enums;

/**
 * The machine-readable half of a readiness decision.
 *
 * HealthScore informs humans; FitnessLevel gates machines. They are separate on
 * purpose — "61/100" means nothing to a dispatch rule, whereas "brake
 * inspection lapsed 3 days ago" does.
 */
enum FitnessLevel: string
{
    case Fit = 'fit';
    case FitWithWarnings = 'fit_with_warnings';
    case Unfit = 'unfit';

    public function label(): string
    {
        return match ($this) {
            self::Fit => 'Fit',
            self::FitWithWarnings => 'Fit with Warnings',
            self::Unfit => 'Unfit',
        };
    }

    /** Whether Dispatch may propose this vehicle without an override. */
    public function isAssignable(): bool
    {
        return $this !== self::Unfit;
    }

    public function tone(): string
    {
        return match ($this) {
            self::Fit => 'success',
            self::FitWithWarnings => 'warning',
            self::Unfit => 'danger',
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
