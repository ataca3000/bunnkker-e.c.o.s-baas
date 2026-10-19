<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Domain\Enums;

enum MacroCategory: string
{
    case WELCOME = 'welcome';
    case ORDER_CONFIRMATION = 'order_confirmation';
    case SHIPPING_UPDATE = 'shipping_update';
    case PAYMENT_REMINDER = 'payment_reminder';
    case REFUND = 'refund';
    case COMPLAINT = 'complaint';
    case SUPPORT = 'support';
    case CUSTOM = 'custom';

    public function label(): string
    {
        return ucwords(str_replace('_', ' ', $this->value));
    }
}
