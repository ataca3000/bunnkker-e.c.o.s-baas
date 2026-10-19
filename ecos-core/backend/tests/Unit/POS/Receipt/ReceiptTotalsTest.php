<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Receipt;

use InvalidArgumentException;
use Modules\POS\Receipt\Domain\ValueObjects\ReceiptTotals;
use PHPUnit\Framework\TestCase;

final class ReceiptTotalsTest extends TestCase
{
    private function makeTotals(array $overrides = []): ReceiptTotals
    {
        return ReceiptTotals::of(
            subtotalAmount: $overrides['subtotalAmount'] ?? '100.00',
            discountAmount: $overrides['discountAmount'] ?? '0.00',
            taxAmount: $overrides['taxAmount'] ?? '14.00',
            totalAmount: $overrides['totalAmount'] ?? '114.00',
            tenderedAmount: $overrides['tenderedAmount'] ?? '120.00',
            changeAmount: $overrides['changeAmount'] ?? '6.00',
            currency: $overrides['currency'] ?? 'EGP',
        );
    }

    public function test_rejects_empty_currency(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Currency cannot be empty');

        $this->makeTotals(['currency' => '']);
    }

    public function test_currency_is_uppercased(): void
    {
        $totals = $this->makeTotals(['currency' => 'egp']);

        $this->assertSame('EGP', $totals->currency);
    }

    public function test_amounts_are_preserved(): void
    {
        $totals = $this->makeTotals();

        $this->assertSame('100.00', $totals->subtotalAmount);
        $this->assertSame('0.00', $totals->discountAmount);
        $this->assertSame('14.00', $totals->taxAmount);
        $this->assertSame('114.00', $totals->totalAmount);
        $this->assertSame('120.00', $totals->tenderedAmount);
        $this->assertSame('6.00', $totals->changeAmount);
    }

    public function test_to_array_has_expected_keys(): void
    {
        $array = $this->makeTotals()->toArray();

        $this->assertArrayHasKey('subtotal_amount', $array);
        $this->assertArrayHasKey('discount_amount', $array);
        $this->assertArrayHasKey('tax_amount', $array);
        $this->assertArrayHasKey('total_amount', $array);
        $this->assertArrayHasKey('tendered_amount', $array);
        $this->assertArrayHasKey('change_amount', $array);
        $this->assertArrayHasKey('currency', $array);
    }

    public function test_round_trips_via_array(): void
    {
        $original = $this->makeTotals();
        $restored = ReceiptTotals::fromArray($original->toArray());

        $this->assertSame($original->subtotalAmount, $restored->subtotalAmount);
        $this->assertSame($original->totalAmount, $restored->totalAmount);
        $this->assertSame($original->tenderedAmount, $restored->tenderedAmount);
        $this->assertSame($original->changeAmount, $restored->changeAmount);
        $this->assertSame($original->currency, $restored->currency);
    }
}
