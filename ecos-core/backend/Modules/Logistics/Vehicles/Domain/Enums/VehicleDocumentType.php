<?php

declare(strict_types=1);

namespace Modules\Logistics\Vehicles\Domain\Enums;

enum VehicleDocumentType: string
{
    case License = 'license';
    case Insurance = 'insurance';
    case Inspection = 'inspection';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::License => 'Vehicle Licence',
            self::Insurance => 'Insurance',
            self::Inspection => 'Inspection Certificate',
            self::Other => 'Other Document',
        };
    }

    /**
     * BR-7 — an expired licence or insurance blocks the vehicle from delivery.
     * Inspection and Other are informational and do not gate dispatch.
     */
    public function blocksDispatchWhenExpired(): bool
    {
        return in_array($this, [self::License, self::Insurance], true);
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
