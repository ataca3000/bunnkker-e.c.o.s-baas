<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Enums;

/**
 * What makes a maintenance plan come due. A plan may carry several triggers;
 * whichever fires first wins.
 *
 * Directive 5: `engine_hours` may depend on Telemetry, which is optional and
 * deferred to Phase 8 (D3). A plan whose ONLY trigger is engine hours could
 * therefore never be evaluated, so MaintenanceSchedulingService rejects that
 * configuration — see requiresTelemetry().
 */
enum MaintenanceTrigger: string
{
    case Distance = 'distance';
    case Time = 'time';
    case EngineHours = 'engine_hours';

    public function label(): string
    {
        return match ($this) {
            self::Distance => 'Distance',
            self::Time => 'Time',
            self::EngineHours => 'Engine Hours',
        };
    }

    public function unit(): string
    {
        return match ($this) {
            self::Distance => 'km',
            self::Time => 'days',
            self::EngineHours => 'hours',
        };
    }

    /** True for triggers that cannot be evaluated without an optional source. */
    public function requiresTelemetry(): bool
    {
        return $this === self::EngineHours;
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }

    /** @return list<array{value: string, label: string, unit: string}> */
    public static function options(): array
    {
        return array_map(
            static fn (self $c) => [
                'value' => $c->value,
                'label' => $c->label(),
                'unit' => $c->unit(),
            ],
            self::cases(),
        );
    }
}
