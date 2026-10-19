<?php

declare(strict_types=1);

namespace Modules\Purchasing\SupplierReturns\Domain\Enums;

enum SupplierReturnReason: string
{
    case Defective = 'defective';
    case WrongItem = 'wrong_item';
    case Overdelivery = 'overdelivery';
    case QualityIssue = 'quality_issue';
    case PriceDiscrepancy = 'price_discrepancy';
    case Expired = 'expired';
    case Damaged = 'damaged';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Defective => 'Defective Product',
            self::WrongItem => 'Wrong Item Delivered',
            self::Overdelivery => 'Overdelivery',
            self::QualityIssue => 'Quality Issue',
            self::PriceDiscrepancy => 'Price Discrepancy',
            self::Expired => 'Expired Product',
            self::Damaged => 'Damaged in Transit',
            self::Other => 'Other',
        };
    }
}
