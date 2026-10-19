<?php

declare(strict_types=1);

namespace Modules\POS\Pricing\Domain\Services;

use InvalidArgumentException;
use Modules\POS\Pricing\Domain\Exceptions\InvalidPriceCurrencyException;
use Modules\POS\Shared\Domain\ValueObjects\Money;

/**
 * Validates resolved prices before they are presented to the POS application.
 *
 * Currency validation uses a curated set of ISO 4217 codes covering
 * MENA markets and major global currencies.
 * Format validation (3 uppercase letters) catches typos before the list check.
 */
final class PriceValidator
{
    private const SUPPORTED_CURRENCIES = [
        // MENA
        'EGP', 'SAR', 'AED', 'KWD', 'QAR', 'OMR', 'BHD', 'JOD',
        'LBP', 'SYP', 'IQD', 'YER', 'DZD', 'MAD', 'TND', 'LYD', 'SDG',
        // Major global
        'USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CNY', 'CAD', 'AUD',
        'SEK', 'NOK', 'DKK', 'SGD', 'HKD', 'INR', 'PKR', 'BDT',
        'TRY', 'NGN', 'ZAR', 'MXN', 'BRL', 'ARS', 'RUB', 'KRW',
    ];

    /**
     * Validate that the currency code is a recognised ISO 4217 code.
     *
     * @throws InvalidPriceCurrencyException
     */
    public function validateCurrency(string $currency): void
    {
        $upper = strtoupper(trim($currency));

        if ($upper === '') {
            throw InvalidPriceCurrencyException::empty();
        }
        if (! preg_match('/^[A-Z]{3}$/', $upper)) {
            throw InvalidPriceCurrencyException::malformed($currency);
        }
        if (! in_array($upper, self::SUPPORTED_CURRENCIES, true)) {
            throw InvalidPriceCurrencyException::unsupported($currency);
        }
    }

    /**
     * Validate that the resolved price is a positive monetary amount.
     *
     * @throws InvalidArgumentException
     */
    public function validatePrice(Money $price): void
    {
        if (! $price->isPositive()) {
            throw new InvalidArgumentException(
                "Resolved price must be positive; got {$price->amount} {$price->currency}.",
            );
        }
    }

    /**
     * Validate both the currency and the price amount in one call.
     *
     * @throws InvalidPriceCurrencyException
     * @throws InvalidArgumentException
     */
    public function validate(Money $price): void
    {
        $this->validateCurrency($price->currency);
        $this->validatePrice($price);
    }
}
