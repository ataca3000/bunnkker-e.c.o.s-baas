<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Enums;

/**
 * Customer-facing return, distinct from Distribution's TripReturn.
 *
 * Distribution's TripReturn records what physically came back on the vehicle.
 * This records what the CUSTOMER did not accept and why, with line-level
 * warehouse reconciliation.
 */
enum DeliveryReturnStatus: string
{
    case Initiated = 'initiated';
    case InTransit = 'in_transit';
    case Received = 'received';
    case Verified = 'verified';
    case Discrepancy = 'discrepancy';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Initiated => 'Initiated',
            self::InTransit => 'In Transit',
            self::Received => 'Received at Warehouse',
            self::Verified => 'Verified',
            self::Discrepancy => 'Discrepancy',
            self::Cancelled => 'Cancelled',
        };
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Initiated => [self::InTransit, self::Cancelled],
            self::InTransit => [self::Received, self::Cancelled],
            self::Received => [self::Verified, self::Discrepancy],
            self::Discrepancy => [self::Verified],
            self::Verified, self::Cancelled => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::Verified, self::Cancelled], true);
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }

    /** @return list<array{value: string, label: string}> */
    public static function options(): array
    {
        return array_map(static fn (self $c) => ['value' => $c->value, 'label' => $c->label()], self::cases());
    }
}
