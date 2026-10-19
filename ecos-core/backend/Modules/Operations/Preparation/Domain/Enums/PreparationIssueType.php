<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Enums;

enum PreparationIssueType: string
{
    case MissingMaterial = 'missing_material';
    case DamagedMaterial = 'damaged_material';
    case QualityIssue = 'quality_issue';
    case RecipeMismatch = 'recipe_mismatch';
    case NegativeStock = 'negative_stock';
    case ManualAdjustment = 'manual_adjustment';
    // Config-driven exception types (Phase 12)
    case OutOfStock = 'out_of_stock';
    case RecipeChanged = 'recipe_changed';
    case CostChanged = 'cost_changed';
    case PriceReviewPending = 'price_review_pending';
    case ZoneDisabled = 'zone_disabled';
    case DeliveryWindowClosed = 'delivery_window_closed';
    case ShippingSupended = 'shipping_supended';
    case BrandConfigMissing = 'brand_config_missing';

    public function label(): string
    {
        return match ($this) {
            self::MissingMaterial => 'Missing Material',
            self::DamagedMaterial => 'Damaged Material',
            self::QualityIssue => 'Quality Issue',
            self::RecipeMismatch => 'Recipe Mismatch',
            self::NegativeStock => 'Negative Stock',
            self::ManualAdjustment => 'Manual Adjustment',
            self::OutOfStock => 'Out of Stock',
            self::RecipeChanged => 'Recipe Changed',
            self::CostChanged => 'Cost Changed',
            self::PriceReviewPending => 'Price Review Pending',
            self::ZoneDisabled => 'Zone Disabled',
            self::DeliveryWindowClosed => 'Delivery Window Closed',
            self::ShippingSupended => 'Shipping Suspended',
            self::BrandConfigMissing => 'Brand Configuration Missing',
        };
    }

    public function defaultSeverity(): ExceptionSeverity
    {
        return match ($this) {
            self::MissingMaterial => ExceptionSeverity::Blocking,
            self::DamagedMaterial => ExceptionSeverity::Blocking,
            self::QualityIssue => ExceptionSeverity::Warning,
            self::RecipeMismatch => ExceptionSeverity::Warning,
            self::NegativeStock => ExceptionSeverity::Blocking,
            self::ManualAdjustment => ExceptionSeverity::Informational,
            self::OutOfStock => ExceptionSeverity::Blocking,
            self::RecipeChanged => ExceptionSeverity::Warning,
            self::CostChanged => ExceptionSeverity::Warning,
            self::PriceReviewPending => ExceptionSeverity::Warning,
            self::ZoneDisabled => ExceptionSeverity::Blocking,
            self::DeliveryWindowClosed => ExceptionSeverity::Blocking,
            self::ShippingSupended => ExceptionSeverity::Blocking,
            self::BrandConfigMissing => ExceptionSeverity::Blocking,
        };
    }
}
