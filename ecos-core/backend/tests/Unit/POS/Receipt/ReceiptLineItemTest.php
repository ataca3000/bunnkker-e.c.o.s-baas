<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Receipt;

use InvalidArgumentException;
use Modules\POS\Receipt\Domain\ValueObjects\ReceiptLineItem;
use PHPUnit\Framework\TestCase;

final class ReceiptLineItemTest extends TestCase
{
    private function makeLine(array $overrides = []): ReceiptLineItem
    {
        return ReceiptLineItem::of(
            productId: $overrides['productId'] ?? 'prod-1',
            productName: $overrides['productName'] ?? 'Blue Shirt',
            sku: $overrides['sku'] ?? 'SKU-001',
            quantityValue: $overrides['quantityValue'] ?? '2',
            unitPriceAmount: $overrides['unitPriceAmount'] ?? '50.00',
            lineTotalAmount: $overrides['lineTotalAmount'] ?? '100.00',
            currency: $overrides['currency'] ?? 'EGP',
            discountAmount: $overrides['discountAmount'] ?? null,
            sortOrder: $overrides['sortOrder'] ?? 0,
        );
    }

    // ── Guards ─────────────────────────────────────────────────────────────────

    public function test_rejects_empty_product_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Product ID cannot be empty');

        $this->makeLine(['productId' => '']);
    }

    public function test_rejects_empty_product_name(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Product name cannot be empty');

        $this->makeLine(['productName' => '']);
    }

    public function test_rejects_empty_sku(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('SKU cannot be empty');

        $this->makeLine(['sku' => '']);
    }

    public function test_rejects_empty_currency(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Currency cannot be empty');

        $this->makeLine(['currency' => '']);
    }

    // ── Construction ───────────────────────────────────────────────────────────

    public function test_currency_is_uppercased(): void
    {
        $line = $this->makeLine(['currency' => 'egp']);

        $this->assertSame('EGP', $line->currency);
    }

    public function test_discount_defaults_to_null(): void
    {
        $line = $this->makeLine();

        $this->assertNull($line->discountAmount);
    }

    public function test_discount_is_stored_when_provided(): void
    {
        $line = $this->makeLine(['discountAmount' => '10.00']);

        $this->assertSame('10.00', $line->discountAmount);
    }

    public function test_sort_order_defaults_to_zero(): void
    {
        $this->assertSame(0, $this->makeLine()->sortOrder);
    }

    public function test_sort_order_is_preserved(): void
    {
        $line = $this->makeLine(['sortOrder' => 3]);

        $this->assertSame(3, $line->sortOrder);
    }

    // ── toArray / fromArray ────────────────────────────────────────────────────

    public function test_to_array_has_expected_keys(): void
    {
        $array = $this->makeLine()->toArray();

        $this->assertArrayHasKey('product_id', $array);
        $this->assertArrayHasKey('product_name', $array);
        $this->assertArrayHasKey('sku', $array);
        $this->assertArrayHasKey('quantity_value', $array);
        $this->assertArrayHasKey('unit_price_amount', $array);
        $this->assertArrayHasKey('line_total_amount', $array);
        $this->assertArrayHasKey('currency', $array);
        $this->assertArrayHasKey('discount_amount', $array);
        $this->assertArrayHasKey('sort_order', $array);
    }

    public function test_round_trips_via_array_without_discount(): void
    {
        $original = $this->makeLine();
        $restored = ReceiptLineItem::fromArray($original->toArray());

        $this->assertSame($original->productId, $restored->productId);
        $this->assertSame($original->productName, $restored->productName);
        $this->assertSame($original->sku, $restored->sku);
        $this->assertSame($original->quantityValue, $restored->quantityValue);
        $this->assertSame($original->unitPriceAmount, $restored->unitPriceAmount);
        $this->assertSame($original->lineTotalAmount, $restored->lineTotalAmount);
        $this->assertSame($original->currency, $restored->currency);
        $this->assertNull($restored->discountAmount);
        $this->assertSame($original->sortOrder, $restored->sortOrder);
    }

    public function test_round_trips_via_array_with_discount(): void
    {
        $original = $this->makeLine(['discountAmount' => '5.00', 'sortOrder' => 2]);
        $restored = ReceiptLineItem::fromArray($original->toArray());

        $this->assertSame('5.00', $restored->discountAmount);
        $this->assertSame(2, $restored->sortOrder);
    }
}
