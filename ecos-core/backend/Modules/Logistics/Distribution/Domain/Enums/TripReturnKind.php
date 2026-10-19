<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Domain\Enums;

/**
 * Discriminator for the unified TripReturn entity.
 *
 * TASK-LOG-004B merges the previous DriverDeliveryReturn (undelivered product
 * coming back to the warehouse) and DriverCustodyReturn (equipment and float
 * coming back) into one table, because both model the same event — goods
 * returning with the driver at end of trip — and both reconcile the same way:
 * dispatched vs returned, with a discrepancy and a driver-liability flag.
 */
enum TripReturnKind: string
{
    case Product = 'product';
    case Custody = 'custody';

    public function label(): string
    {
        return match ($this) {
            self::Product => 'Product Return',
            self::Custody => 'Custody Return',
        };
    }

    /** Product returns carry an order and a product; custody returns carry neither. */
    public function requiresOrder(): bool
    {
        return $this === self::Product;
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
