<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\Enums;

enum EventCategory: string
{
    case Marketing = 'marketing';
    case Sales = 'sales';
    case Crm = 'crm';
    case Inventory = 'inventory';
    case Manufacturing = 'manufacturing';
    case Preparation = 'preparation';
    case Packing = 'packing';
    case Shipping = 'shipping';
    case Accounting = 'accounting';
    case Finance = 'finance';
    case Support = 'support';
    case Customer = 'customer';
    case Automation = 'automation';
    case System = 'system';

    public function label(): string
    {
        return match ($this) {
            self::Marketing => 'Marketing',
            self::Sales => 'Sales',
            self::Crm => 'CRM',
            self::Inventory => 'Inventory',
            self::Manufacturing => 'Manufacturing',
            self::Preparation => 'Preparation',
            self::Packing => 'Packing',
            self::Shipping => 'Shipping',
            self::Accounting => 'Accounting',
            self::Finance => 'Finance',
            self::Support => 'Support',
            self::Customer => 'Customer',
            self::Automation => 'Automation',
            self::System => 'System',
        };
    }
}
