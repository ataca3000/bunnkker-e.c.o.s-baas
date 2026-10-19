<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Exchange;

use InvalidArgumentException;
use Modules\POS\Exchange\Domain\ValueObjects\ExchangeLine;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Quantity;
use PHPUnit\Framework\TestCase;

final class ExchangeLineTest extends TestCase
{
    private Quantity $qty1;

    private Quantity $qty2;

    private Money $price100;

    private Money $priceZero;

    protected function setUp(): void
    {
        $this->qty1 = Quantity::of('1');
        $this->qty2 = Quantity::of('2');
        $this->price100 = Money::of('100.00', 'EGP');
        $this->priceZero = Money::zero('EGP');
    }

    // ── returned() factory ───────────────────────────────────────────────────

    public function test_returned_creates_with_original_line_id(): void
    {
        $line = ExchangeLine::returned('line-01', 'prod-1', 'Blue Shirt', 'SKU-001', $this->qty1, $this->price100);

        $this->assertSame('line-01', $line->originalLineId);
        $this->assertTrue($line->isReturnedLine());
        $this->assertFalse($line->isReplacementLine());
    }

    public function test_returned_rejects_empty_original_line_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Original line ID is required');

        ExchangeLine::returned('', 'prod-1', 'Blue Shirt', 'SKU-001', $this->qty1, $this->price100);
    }

    public function test_returned_rejects_empty_product_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Product ID cannot be empty');

        ExchangeLine::returned('line-01', '', 'Blue Shirt', 'SKU-001', $this->qty1, $this->price100);
    }

    public function test_returned_rejects_empty_product_name(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Product name cannot be empty');

        ExchangeLine::returned('line-01', 'prod-1', '', 'SKU-001', $this->qty1, $this->price100);
    }

    public function test_returned_rejects_non_positive_quantity(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('quantity must be positive');

        ExchangeLine::returned('line-01', 'prod-1', 'Shirt', 'SKU-001', Quantity::zero(), $this->price100);
    }

    public function test_returned_rejects_negative_unit_price(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('unit price cannot be negative');

        ExchangeLine::returned('line-01', 'prod-1', 'Shirt', 'SKU-001', $this->qty1, Money::of('-10.00', 'EGP'));
    }

    public function test_returned_allows_zero_unit_price(): void
    {
        $line = ExchangeLine::returned('line-01', 'prod-1', 'Shirt', 'SKU-001', $this->qty1, $this->priceZero);

        $this->assertSame('0.00', $line->unitPrice->amount);
        $this->assertSame('0.00', $line->lineTotal->amount);
    }

    // ── replacement() factory ─────────────────────────────────────────────────

    public function test_replacement_has_null_original_line_id(): void
    {
        $line = ExchangeLine::replacement('prod-2', 'Red Shirt', 'SKU-002', $this->qty1, $this->price100);

        $this->assertNull($line->originalLineId);
        $this->assertFalse($line->isReturnedLine());
        $this->assertTrue($line->isReplacementLine());
    }

    public function test_replacement_rejects_empty_product_id(): void
    {
        $this->expectException(InvalidArgumentException::class);

        ExchangeLine::replacement('', 'Red Shirt', 'SKU-002', $this->qty1, $this->price100);
    }

    // ── lineTotal computation ─────────────────────────────────────────────────

    public function test_line_total_is_unit_price_times_quantity(): void
    {
        $line = ExchangeLine::returned('l1', 'prod-1', 'Shirt', 'SKU', $this->qty2, $this->price100);

        $this->assertSame('200.00', $line->lineTotal->amount);
        $this->assertSame('EGP', $line->lineTotal->currency);
    }

    public function test_line_total_with_fractional_quantity(): void
    {
        $qty = Quantity::of('1.5');
        $line = ExchangeLine::replacement('prod-1', 'Fabric', 'FAB-001', $qty, Money::of('20.00', 'EGP'));

        $this->assertSame('30.00', $line->lineTotal->amount);
    }

    // ── sort_order default ────────────────────────────────────────────────────

    public function test_sort_order_defaults_to_zero(): void
    {
        $line = ExchangeLine::replacement('prod-1', 'Item', 'SKU', $this->qty1, $this->price100);

        $this->assertSame(0, $line->sortOrder);
    }

    public function test_sort_order_is_preserved(): void
    {
        $line = ExchangeLine::replacement('prod-1', 'Item', 'SKU', $this->qty1, $this->price100, 5);

        $this->assertSame(5, $line->sortOrder);
    }

    // ── toArray / fromArray ───────────────────────────────────────────────────

    public function test_to_array_has_expected_keys(): void
    {
        $line = ExchangeLine::returned('l1', 'prod-1', 'Shirt', 'SKU', $this->qty1, $this->price100);
        $array = $line->toArray();

        $this->assertArrayHasKey('original_line_id', $array);
        $this->assertArrayHasKey('product_id', $array);
        $this->assertArrayHasKey('product_name', $array);
        $this->assertArrayHasKey('sku', $array);
        $this->assertArrayHasKey('quantity', $array);
        $this->assertArrayHasKey('unit_price', $array);
        $this->assertArrayHasKey('line_total', $array);
        $this->assertArrayHasKey('sort_order', $array);
    }

    public function test_returned_line_round_trips_via_array(): void
    {
        $original = ExchangeLine::returned('line-42', 'prod-99', 'Test Product', 'TEST-SKU', $this->qty2, $this->price100, 3);
        $restored = ExchangeLine::fromArray($original->toArray());

        $this->assertSame($original->originalLineId, $restored->originalLineId);
        $this->assertSame($original->productId, $restored->productId);
        $this->assertSame($original->productName, $restored->productName);
        $this->assertSame($original->sku, $restored->sku);
        $this->assertSame($original->quantity->value, $restored->quantity->value);
        $this->assertSame($original->unitPrice->amount, $restored->unitPrice->amount);
        $this->assertSame($original->lineTotal->amount, $restored->lineTotal->amount);
        $this->assertSame($original->sortOrder, $restored->sortOrder);
    }

    public function test_replacement_line_round_trips_via_array(): void
    {
        $original = ExchangeLine::replacement('prod-7', 'New Item', 'NEW-SKU', $this->qty1, Money::of('75.50', 'EGP'));
        $restored = ExchangeLine::fromArray($original->toArray());

        $this->assertNull($restored->originalLineId);
        $this->assertSame('prod-7', $restored->productId);
        $this->assertSame('75.50', $restored->unitPrice->amount);
    }
}
