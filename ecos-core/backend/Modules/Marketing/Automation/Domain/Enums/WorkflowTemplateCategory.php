<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Domain\Enums;

enum WorkflowTemplateCategory: string
{
    case WELCOME_SERIES = 'welcome_series';
    case ABANDONED_CART = 'abandoned_cart';
    case LEAD_NURTURING = 'lead_nurturing';
    case NO_REPLY_REMINDER = 'no_reply_reminder';
    case PAYMENT_REMINDER = 'payment_reminder';
    case SHIPMENT_NOTIF = 'shipment_notification';
    case ORDER_DELIVERED = 'order_delivered';
    case REVIEW_REQUEST = 'review_request';
    case BIRTHDAY_CAMPAIGN = 'birthday_campaign';
    case VIP_UPGRADE = 'vip_upgrade';
    case WIN_BACK = 'win_back_customer';
    case SEASONAL = 'seasonal_campaign';
    case RAMADAN_JOURNEY = 'ramadan_journey';
    case BLACK_FRIDAY = 'black_friday_journey';
    case PRODUCT_LAUNCH = 'product_launch';
    case CUSTOM = 'custom';
}
