<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Domain\Enums;

enum ReservationStatus: string
{
    case Pending = 'pending';
    case Reserved = 'reserved';
    case PartialReserved = 'partial_reserved';
    case AwaitingStock = 'awaiting_stock';
    case Released = 'released';
    case Transferred = 'transferred';
    case Consumed = 'consumed';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pending',
            self::Reserved => 'Reserved',
            self::PartialReserved => 'Partially Reserved',
            self::AwaitingStock => 'Awaiting Stock',
            self::Released => 'Released',
            self::Transferred => 'Transferred to Vehicle',
            self::Consumed => 'Consumed',
        };
    }

    public function canTransitionTo(self $next): bool
    {
        return match ($this) {
            self::Pending => in_array($next, [self::Reserved, self::PartialReserved, self::AwaitingStock], true),
            self::Reserved => in_array($next, [self::Released, self::Transferred], true),
            self::PartialReserved => in_array($next, [self::Reserved, self::Released, self::Transferred, self::AwaitingStock], true),
            self::AwaitingStock => in_array($next, [self::Reserved, self::PartialReserved, self::Released], true),
            self::Released => false,
            self::Transferred => in_array($next, [self::Consumed, self::Released], true),
            self::Consumed => false,
        };
    }
}
