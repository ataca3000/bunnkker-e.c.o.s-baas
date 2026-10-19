<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\Enums;

enum NodeType: string
{
    case Customer = 'customer';
    case Order = 'order';
    case Campaign = 'campaign';
    case Initiative = 'initiative';
    case Conversation = 'conversation';
    case Shipment = 'shipment';
    case Invoice = 'invoice';
    case Warehouse = 'warehouse';
    case Company = 'company';
    case Brand = 'brand';
    case Channel = 'channel';
    case MarketingUser = 'marketing_user';
    case SalesUser = 'sales_user';
    case Lead = 'lead';
    case Payment = 'payment';

    public function label(): string
    {
        return match ($this) {
            self::Customer => 'Customer',
            self::Order => 'Order',
            self::Campaign => 'Campaign',
            self::Initiative => 'Initiative',
            self::Conversation => 'Conversation',
            self::Shipment => 'Shipment',
            self::Invoice => 'Invoice',
            self::Warehouse => 'Warehouse',
            self::Company => 'Company',
            self::Brand => 'Brand',
            self::Channel => 'Channel',
            self::MarketingUser => 'Marketing User',
            self::SalesUser => 'Sales User',
            self::Lead => 'Lead',
            self::Payment => 'Payment',
        };
    }
}
