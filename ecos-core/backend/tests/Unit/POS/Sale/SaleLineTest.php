<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Sale;

use Modules\POS\Sale\Domain\ValueObjects\SaleLine;
use Modules\POS\Shared\Domain\Enums\DiscountType;
use PHPUnit\Framework\TestCase;

/**
 * PKG-POS-008: SaleLine value object unit tests.
 * Pure unit tests — no database, no Laravel boot.
 */
final class SaleLineTest extends TestCase
{
    private function makeCartLineData(
        string $lineId = 'line-uuid-1',
        string $qty = '2.0000',
        string $price = '10.00',
        string $lineTotal = '20.00',
        string $currency = 'EGP',
        ?string $discountType = null,
        ?string $discountValue = null,
        int $sortOrder = 0,
    ): array {
        return [
            'id' => $lineId,
            'product_id' => 'prod-uuid-1',
            'product_name' => 'Widget',
            'sku' => 'WGT-001',
            'quantity' => $qty,
            'unit_price' => ['amount' => $price, 'currency' => $currency],
            'discount_type' => $discountType,
            'discount_value' => $discountValue,
            'line_total' => ['amount' => $lineTotal, 'currency' => $currency],
            'sort_order' => $sortOrder,
        ];
    }

    // ── fromCartLine() ────────────────────────────────────────────────────────

    public function test_from_cart_line_maps_line_id_from_id(): void
    {
        $line = SaleLine::fromCartLine($this->makeCartLineData(lineId: 'cart-line-abc'));
        $this->assertSame('cart-line-abc', $line->lineId);
    }

    public function test_from_cart_line_stores_product_fields(): void
    {
        $line = SaleLine::fromCartLine($this->makeCartLineData());
        $this->assertSame('prod-uuid-1', $line->productId);
        $this->assertSame('Widget', $line->productName);
        $this->assertSame('WGT-001', $line->sku);
    }

    public function test_from_cart_line_stores_quantity(): void
    {
        $line = SaleLine::fromCartLine($this->makeCartLineData(qty: '3.0000'));
        $this->assertSame('3.0000', $line->quantity->value);
    }

    public function test_from_cart_line_stores_unit_price_as_money(): void
    {
        $line = SaleLine::fromCartLine($this->makeCartLineData(price: '25.00'));
        $this->assertSame('25.00', $line->unitPrice->amount);
        $this->assertSame('EGP', $line->unitPrice->currency);
    }

    public function test_from_cart_line_stores_line_total_as_money(): void
    {
        $line = SaleLine::fromCartLine($this->makeCartLineData(lineTotal: '75.00'));
        $this->assertSame('75.00', $line->lineTotal->amount);
    }

    public function test_from_cart_line_handles_null_discount(): void
    {
        $line = SaleLine::fromCartLine($this->makeCartLineData());
        $this->assertNull($line->discountType);
        $this->assertNull($line->discountValue);
    }

    public function test_from_cart_line_stores_percentage_discount(): void
    {
        $line = SaleLine::fromCartLine($this->makeCartLineData(
            discountType: 'percentage',
            discountValue: '10',
            lineTotal: '18.00',
        ));
        $this->assertSame(DiscountType::Percentage, $line->discountType);
        $this->assertSame('10', $line->discountValue);
    }

    public function test_from_cart_line_stores_sort_order(): void
    {
        $line = SaleLine::fromCartLine($this->makeCartLineData(sortOrder: 3));
        $this->assertSame(3, $line->sortOrder);
    }

    // ── toArray() ─────────────────────────────────────────────────────────────

    public function test_to_array_contains_required_keys(): void
    {
        $array = SaleLine::fromCartLine($this->makeCartLineData())->toArray();
        foreach (['line_id', 'product_id', 'product_name', 'sku', 'quantity',
            'unit_price', 'discount_type', 'discount_value',
            'line_total', 'sort_order'] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing key: {$key}");
        }
    }

    public function test_to_array_uses_line_id_key(): void
    {
        $array = SaleLine::fromCartLine($this->makeCartLineData(lineId: 'uuid-xyz'))->toArray();
        $this->assertArrayHasKey('line_id', $array);
        $this->assertSame('uuid-xyz', $array['line_id']);
    }

    public function test_to_array_serialises_money_as_nested_array(): void
    {
        $array = SaleLine::fromCartLine($this->makeCartLineData(price: '12.50'))->toArray();
        $this->assertIsArray($array['unit_price']);
        $this->assertSame('12.50', $array['unit_price']['amount']);
        $this->assertSame('EGP', $array['unit_price']['currency']);
    }

    public function test_to_array_serialises_quantity_as_string(): void
    {
        $array = SaleLine::fromCartLine($this->makeCartLineData(qty: '4.0000'))->toArray();
        $this->assertIsString($array['quantity']);
        $this->assertSame('4.0000', $array['quantity']);
    }

    // ── fromArray / roundtrip ─────────────────────────────────────────────────

    public function test_roundtrip_to_array_from_array(): void
    {
        $original = SaleLine::fromCartLine($this->makeCartLineData(
            lineId: 'line-roundtrip',
            qty: '5.0000',
            price: '15.00',
            lineTotal: '67.50',
            discountType: 'percentage',
            discountValue: '10',
        ));

        $restored = SaleLine::fromArray($original->toArray());

        $this->assertSame('line-roundtrip', $restored->lineId);
        $this->assertSame('5.0000', $restored->quantity->value);
        $this->assertSame('15.00', $restored->unitPrice->amount);
        $this->assertSame('67.50', $restored->lineTotal->amount);
        $this->assertSame(DiscountType::Percentage, $restored->discountType);
    }

    public function test_from_array_handles_null_discount(): void
    {
        $line = SaleLine::fromArray([
            'line_id' => 'uuid-x',
            'product_id' => 'p',
            'product_name' => 'P',
            'sku' => 'SKU',
            'quantity' => '1.0000',
            'unit_price' => ['amount' => '5.00', 'currency' => 'EGP'],
            'discount_type' => null,
            'discount_value' => null,
            'line_total' => ['amount' => '5.00', 'currency' => 'EGP'],
            'sort_order' => 0,
        ]);

        $this->assertNull($line->discountType);
        $this->assertNull($line->discountValue);
    }
}
