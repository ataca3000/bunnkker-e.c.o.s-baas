<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Enums;

/**
 * D8 (CTO approved): Fleet owns OPERATIONAL costs only. Accounting remains the
 * financial authority — these entries are expense facts posted onward, never a
 * ledger of record, and never trip cash (Distribution is the Single Cash
 * Authority).
 */
enum CostType: string
{
    case Fuel = 'fuel';
    case Maintenance = 'maintenance';
    case Inspection = 'inspection';
    case Insurance = 'insurance';
    case Licensing = 'licensing';
    case Depreciation = 'depreciation';
    case Tyres = 'tyres';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Fuel => 'Fuel',
            self::Maintenance => 'Maintenance',
            self::Inspection => 'Inspection',
            self::Insurance => 'Insurance',
            self::Licensing => 'Licensing',
            self::Depreciation => 'Depreciation',
            self::Tyres => 'Tyres',
            self::Other => 'Other',
        };
    }

    /** Costs that vary with distance travelled, as opposed to fixed overheads. */
    public function isVariable(): bool
    {
        return in_array($this, [self::Fuel, self::Maintenance, self::Tyres], true);
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
