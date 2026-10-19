<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Pricing;

use InvalidArgumentException;
use Modules\POS\Pricing\Domain\Exceptions\InvalidPriceCurrencyException;
use Modules\POS\Pricing\Domain\Services\PriceValidator;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use PHPUnit\Framework\TestCase;

final class PriceValidatorTest extends TestCase
{
    private PriceValidator $validator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->validator = new PriceValidator;
    }

    // ── validateCurrency() ────────────────────────────────────────────────────

    public function test_valid_currency_passes(): void
    {
        $this->validator->validateCurrency('EGP');
        $this->addToAssertionCount(1);
    }

    public function test_usd_is_valid(): void
    {
        $this->validator->validateCurrency('USD');
        $this->addToAssertionCount(1);
    }

    public function test_eur_is_valid(): void
    {
        $this->validator->validateCurrency('EUR');
        $this->addToAssertionCount(1);
    }

    public function test_sar_is_valid(): void
    {
        $this->validator->validateCurrency('SAR');
        $this->addToAssertionCount(1);
    }

    public function test_lowercase_is_accepted_and_uppercased_internally(): void
    {
        $this->validator->validateCurrency('egp');
        $this->addToAssertionCount(1);
    }

    public function test_empty_currency_throws(): void
    {
        $this->expectException(InvalidPriceCurrencyException::class);
        $this->validator->validateCurrency('');
    }

    public function test_whitespace_only_currency_throws(): void
    {
        $this->expectException(InvalidPriceCurrencyException::class);
        $this->validator->validateCurrency('   ');
    }

    public function test_two_letter_code_throws_malformed(): void
    {
        $this->expectException(InvalidPriceCurrencyException::class);
        $this->validator->validateCurrency('EG');
    }

    public function test_four_letter_code_throws_malformed(): void
    {
        $this->expectException(InvalidPriceCurrencyException::class);
        $this->validator->validateCurrency('EGPP');
    }

    public function test_code_with_digits_throws_malformed(): void
    {
        $this->expectException(InvalidPriceCurrencyException::class);
        $this->validator->validateCurrency('E1P');
    }

    public function test_code_with_spaces_throws_malformed(): void
    {
        $this->expectException(InvalidPriceCurrencyException::class);
        $this->validator->validateCurrency('E G P');
    }

    public function test_valid_format_but_unsupported_code_throws(): void
    {
        $this->expectException(InvalidPriceCurrencyException::class);
        $this->validator->validateCurrency('XXX');
    }

    // ── validatePrice() ───────────────────────────────────────────────────────

    public function test_positive_price_passes(): void
    {
        $this->validator->validatePrice(Money::of('0.01', 'EGP'));
        $this->addToAssertionCount(1);
    }

    public function test_large_positive_price_passes(): void
    {
        $this->validator->validatePrice(Money::of('999999.99', 'EGP'));
        $this->addToAssertionCount(1);
    }

    public function test_zero_price_throws(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->validator->validatePrice(Money::zero('EGP'));
    }

    public function test_negative_price_throws(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->validator->validatePrice(Money::of('-10.00', 'EGP'));
    }

    // ── validate() ────────────────────────────────────────────────────────────

    public function test_valid_positive_price_with_valid_currency_passes(): void
    {
        $this->validator->validate(Money::of('50.00', 'EGP'));
        $this->addToAssertionCount(1);
    }

    public function test_validate_catches_invalid_currency_on_money(): void
    {
        $this->expectException(InvalidPriceCurrencyException::class);
        // Money::of accepts any non-empty string as currency — validator catches it
        $badCurrencyMoney = new Money('50.00', 'ZZZ');
        $this->validator->validate($badCurrencyMoney);
    }

    public function test_validate_catches_zero_price(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->validator->validate(Money::zero('EGP'));
    }
}
