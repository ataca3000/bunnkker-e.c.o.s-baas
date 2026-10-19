<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Enums;

/**
 * Queue priority.
 *
 * `rank` is DERIVED from priority plus age, never set directly by a caller —
 * otherwise every integration marks its own trips urgent and the ordering
 * stops meaning anything.
 */
enum QueuePriority: string
{
    case Critical = 'critical';
    case High = 'high';
    case Normal = 'normal';
    case Low = 'low';

    public function label(): string
    {
        return match ($this) {
            self::Critical => 'Critical',
            self::High => 'High',
            self::Normal => 'Normal',
            self::Low => 'Low',
        };
    }

    /** Base rank. Lower sorts first. */
    public function baseRank(): int
    {
        return match ($this) {
            self::Critical => 0,
            self::High => 1000,
            self::Normal => 2000,
            self::Low => 3000,
        };
    }

    /**
     * How much each waiting minute improves rank.
     *
     * Ageing prevents starvation: a Low item that has waited two hours should
     * eventually overtake a Normal one that just arrived, or the bottom of the
     * queue never moves.
     */
    public function ageWeight(): int
    {
        return match ($this) {
            self::Critical => 0,        // Already first; ageing is meaningless.
            self::High => 2,
            self::Normal => 1,
            self::Low => 1,
        };
    }

    public function tone(): string
    {
        return match ($this) {
            self::Critical => 'danger',
            self::High => 'warning',
            self::Normal => 'info',
            self::Low => 'neutral',
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
