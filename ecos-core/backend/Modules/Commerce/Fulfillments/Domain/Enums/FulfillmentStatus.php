<?php

declare(strict_types=1);

namespace Modules\Commerce\Fulfillments\Domain\Enums;

enum FulfillmentStatus: string
{
    case Pending = 'pending';
    case Fulfilled = 'fulfilled';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pending',
            self::Fulfilled => 'Fulfilled',
            self::Cancelled => 'Cancelled',
        };
    }
}
