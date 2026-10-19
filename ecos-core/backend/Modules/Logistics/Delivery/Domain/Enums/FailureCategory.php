<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Enums;

/**
 * Failure taxonomy. Category carries the DEFAULT retryability; an individual
 * reason may override it (customer refusal is not retryable even though the
 * Customer category generally is).
 */
enum FailureCategory: string
{
    case Customer = 'customer';
    case Address = 'address';
    case Product = 'product';
    case Payment = 'payment';
    case Operational = 'operational';

    public function label(): string
    {
        return match ($this) {
            self::Customer => 'Customer',
            self::Address => 'Address',
            self::Product => 'Product',
            self::Payment => 'Payment',
            self::Operational => 'Operational',
        };
    }

    public function isRetryableByDefault(): bool
    {
        // Product faults mean the goods are wrong or damaged — a retry with the
        // same goods cannot succeed, so these always return instead.
        return $this !== self::Product;
    }

    /** Categories whose failures leave goods on the vehicle that must come back. */
    public function generatesReturn(): bool
    {
        return true;
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }

    /** @return list<array{value: string, label: string}> */
    public static function options(): array
    {
        return array_map(static fn (self $c) => ['value' => $c->value, 'label' => $c->label()], self::cases());
    }
}
