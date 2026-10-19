<?php

declare(strict_types=1);

namespace Modules\CostManagement\Domain\Enums;

enum PricingTriggerReason: string
{
    case MaterialCostChanged = 'material_cost_changed';
    case RecipeUpdated = 'recipe_updated';
    case PackagingChanged = 'packaging_changed';
    case ManufacturingCostChanged = 'manufacturing_cost_changed';
    case SupplierPriceChanged = 'supplier_price_changed';
    case PurchaseReceiptPosted = 'purchase_receipt_posted';
    case ManualCostOverride = 'manual_cost_override';
    case ExchangeRateChanged = 'exchange_rate_changed';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::MaterialCostChanged => 'Material Cost Changed',
            self::RecipeUpdated => 'Recipe Updated',
            self::PackagingChanged => 'Packaging Changed',
            self::ManufacturingCostChanged => 'Manufacturing Cost Changed',
            self::SupplierPriceChanged => 'Supplier Price Changed',
            self::PurchaseReceiptPosted => 'Purchase Receipt Posted',
            self::ManualCostOverride => 'Manual Cost Override',
            self::ExchangeRateChanged => 'Exchange Rate Changed',
            self::Other => 'Other',
        };
    }

    /** Convert any legacy string value to the matching enum case, falling back to Other. */
    public static function fromLegacyString(string $value): self
    {
        return self::tryFrom($value) ?? self::Other;
    }
}
