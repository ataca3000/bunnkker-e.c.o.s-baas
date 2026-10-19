<?php

declare(strict_types=1);

namespace Modules\Logistics\Routing\Domain\Enums;

enum RoutePlanStatus: string
{
    case Draft = 'draft';
    case Optimizing = 'optimizing';
    case Failed = 'failed';
    case Planned = 'planned';
    case Active = 'active';
    case Superseded = 'superseded';
    case Completed = 'completed';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Optimizing => 'Optimizing',
            self::Failed => 'Failed',
            self::Planned => 'Planned',
            self::Active => 'Active',
            self::Superseded => 'Superseded',
            self::Completed => 'Completed',
            self::Cancelled => 'Cancelled',
        };
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Draft => [self::Optimizing, self::Cancelled],
            self::Optimizing => [self::Planned, self::Failed],
            self::Failed => [self::Optimizing, self::Cancelled],
            self::Planned => [self::Active, self::Superseded, self::Cancelled],
            self::Active => [self::Completed, self::Superseded],
            self::Superseded, self::Completed, self::Cancelled => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::Superseded, self::Completed, self::Cancelled], true);
    }

    /** A plan that is still the live answer for its trip. */
    public function isCurrent(): bool
    {
        return in_array($this, [self::Planned, self::Active], true);
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
