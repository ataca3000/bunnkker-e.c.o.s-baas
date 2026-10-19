<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Enums;

/**
 * The concrete failure taxonomy. Each reason maps to a category and states
 * whether a retry could plausibly succeed.
 *
 * Retryability lives here rather than in the caller so the same decision is
 * reached whether a failure arrives from the driver app, operations or an API.
 */
enum FailureReason: string
{
    // Customer
    case CustomerUnavailable = 'customer_unavailable';
    case CustomerRefused = 'customer_refused';
    case CustomerRescheduled = 'customer_rescheduled';
    case NoAnswer = 'no_answer';

    // Address
    case AddressNotFound = 'address_not_found';
    case AddressInaccessible = 'address_inaccessible';
    case WrongArea = 'wrong_area';

    // Product
    case ProductDamaged = 'product_damaged';
    case WrongItem = 'wrong_item';
    case ItemMissing = 'item_missing';

    // Payment
    case CannotPay = 'cannot_pay';
    case AmountDisputed = 'amount_disputed';

    // Operational
    case VehicleBreakdown = 'vehicle_breakdown';
    case TimeExhausted = 'time_exhausted';
    case Weather = 'weather';

    public function category(): FailureCategory
    {
        return match ($this) {
            self::CustomerUnavailable, self::CustomerRefused,
            self::CustomerRescheduled, self::NoAnswer => FailureCategory::Customer,

            self::AddressNotFound, self::AddressInaccessible,
            self::WrongArea => FailureCategory::Address,

            self::ProductDamaged, self::WrongItem,
            self::ItemMissing => FailureCategory::Product,

            self::CannotPay, self::AmountDisputed => FailureCategory::Payment,

            self::VehicleBreakdown, self::TimeExhausted,
            self::Weather => FailureCategory::Operational,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::CustomerUnavailable => 'Customer unavailable',
            self::CustomerRefused => 'Customer refused delivery',
            self::CustomerRescheduled => 'Customer rescheduled',
            self::NoAnswer => 'No answer',
            self::AddressNotFound => 'Address not found',
            self::AddressInaccessible => 'Address inaccessible',
            self::WrongArea => 'Wrong area',
            self::ProductDamaged => 'Product damaged',
            self::WrongItem => 'Wrong item',
            self::ItemMissing => 'Item missing',
            self::CannotPay => 'Customer cannot pay',
            self::AmountDisputed => 'Amount disputed',
            self::VehicleBreakdown => 'Vehicle breakdown',
            self::TimeExhausted => 'Delivery time exhausted',
            self::Weather => 'Weather conditions',
        };
    }

    /** BR-9/BR-10: refusal and product faults never auto-retry. */
    public function isRetryable(): bool
    {
        return match ($this) {
            self::CustomerRefused => false,
            self::ProductDamaged, self::WrongItem, self::ItemMissing => false,
            default => $this->category()->isRetryableByDefault(),
        };
    }

    /** BR-11: an address failure must be corrected before a retry is scheduled. */
    public function requiresAddressCorrection(): bool
    {
        return $this->category() === FailureCategory::Address;
    }

    public function isCustomerFault(): bool
    {
        return $this->category() === FailureCategory::Customer;
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }

    /**
     * @return list<array{value: string, label: string, category: string, is_retryable: bool, requires_address_correction: bool}>
     */
    public static function catalogue(): array
    {
        return array_map(static fn (self $c) => [
            'value' => $c->value,
            'label' => $c->label(),
            'category' => $c->category()->value,
            'category_label' => $c->category()->label(),
            'is_retryable' => $c->isRetryable(),
            'requires_address_correction' => $c->requiresAddressCorrection(),
        ], self::cases());
    }
}
