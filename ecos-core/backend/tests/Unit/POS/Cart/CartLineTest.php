<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Cart;

use Modules\POS\Cart\Domain\ValueObjects\CartLine;
use Modules\POS\Shared\Domain\Enums\DiscountType;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Quantity;
use PHPUnit\Framework\TestCase;

/**
 * PKG-POS-006: CartLine value object unit tests.
 * Pure unit tests — no database, no Laravel boot.
 */
final class CartLineTest extends TestCase
{
    private function makeLine(
        string $qty = '2.0000',
        string $price = '10.00',
        string $currency = 'EGP',
        ?DiscountType $discountType = null,
        ?string $discountVal = null,
    ): CartLine {
        return CartLine::create(
            productId: 'prod-uuid-1',
            productName: 'Widget',
            sku: 'WGT-001',
            quantity: Quantity::of($qty),
            unitPrice: Money::of($price, $currency),
            discountType: $discountType,
            discountValue: $discountVal,
        );
    }

    // ── create() ──────────────────────────────────────────────────────────────

    public function test_create_generates_non_empty_id(): void
    {
        $line = $this->makeLine();

        $this->assertNotEmpty($line->id);
    }

    public function test_two_creates_have_different_ids(): void
    {
        $a = $this->makeLine();
        $b = $this->makeLine();

        $this->assertNotSame($a->id, $b->id);
    }

    public function test_create_stores_product_fields(): void
    {
        $line = $this->makeLine();

        $this->assertSame('prod-uuid-1', $line->productId);
        $this->assertSame('Widget', $line->productName);
        $this->assertSame('WGT-001', $line->sku);
    }

    public function test_create_calculates_line_total_without_discount(): void
    {
        // 2 × 10.00 = 20.00
        $line = $this->makeLine(qty: '2.0000', price: '10.00');

        $this->assertSame('20.00', $line->lineTotal->amount);
        $this->assertSame('EGP', $line->lineTotal->currency);
    }

    public function test_create_calculates_line_total_with_percentage_discount(): void
    {
        // 3 × 10.00 = 30.00; 10% off → discount = 3.00; total = 27.00
        $line = $this->makeLine(
            qty: '3.0000',
            price: '10.00',
            discountType: DiscountType::Percentage,
            discountVal: '10',
        );

        $this->assertSame('27.00', $line->lineTotal->amount);
    }

    public function test_create_calculates_line_total_with_fixed_discount(): void
    {
        // 2 × 15.00 = 30.00; fixed 5.00 off → 25.00
        $line = $this->makeLine(
            qty: '2.0000',
            price: '15.00',
            discountType: DiscountType::FixedAmount,
            discountVal: '5.00',
        );

        $this->assertSame('25.00', $line->lineTotal->amount);
    }

    public function test_create_sets_null_discount_when_not_provided(): void
    {
        $line = $this->makeLine();

        $this->assertNull($line->discountType);
        $this->assertNull($line->discountValue);
    }

    public function test_create_assigns_sort_order(): void
    {
        $line = CartLine::create('p', 'P', 'SKU', Quantity::of(1), Money::of(1, 'EGP'), sortOrder: 5);

        $this->assertSame(5, $line->sortOrder);
    }

    // ── withQuantity() ────────────────────────────────────────────────────────

    public function test_with_quantity_recalculates_line_total(): void
    {
        $original = $this->makeLine(qty: '2.0000', price: '10.00'); // 20.00
        $updated = $original->withQuantity(Quantity::of('5.0000')); // 50.00

        $this->assertSame('50.00', $updated->lineTotal->amount);
    }

    public function test_with_quantity_preserves_discount(): void
    {
        $original = $this->makeLine(
            qty: '2.0000',
            price: '10.00',
            discountType: DiscountType::Percentage,
            discountVal: '10',
        ); // (20.00 - 10%) = 18.00

        // Update to qty 4 → (40.00 - 10%) = 36.00
        $updated = $original->withQuantity(Quantity::of('4.0000'));

        $this->assertSame('36.00', $updated->lineTotal->amount);
        $this->assertSame(DiscountType::Percentage, $updated->discountType);
    }

    public function test_with_quantity_does_not_mutate_original(): void
    {
        $original = $this->makeLine(qty: '2.0000', price: '10.00');
        $original->withQuantity(Quantity::of('9.0000'));

        $this->assertSame('2.0000', $original->quantity->value);
        $this->assertSame('20.00', $original->lineTotal->amount);
    }

    public function test_with_quantity_preserves_id(): void
    {
        $original = $this->makeLine();
        $updated = $original->withQuantity(Quantity::of(3));

        $this->assertSame($original->id, $updated->id);
    }

    // ── toArray / fromArray ───────────────────────────────────────────────────

    public function test_to_array_contains_required_keys(): void
    {
        $array = $this->makeLine()->toArray();

        foreach (['id', 'product_id', 'product_name', 'sku', 'quantity',
            'unit_price', 'discount_type', 'discount_value',
            'line_total', 'sort_order'] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing key: {$key}");
        }
    }

    public function test_to_array_serialises_money_as_nested_array(): void
    {
        $array = $this->makeLine(price: '25.00')->toArray();

        $this->assertIsArray($array['unit_price']);
        $this->assertSame('25.00', $array['unit_price']['amount']);
        $this->assertSame('EGP', $array['unit_price']['currency']);
    }

    public function test_roundtrip_to_array_from_array(): void
    {
        $original = $this->makeLine(
            qty: '3.0000',
            price: '12.50',
            discountType: DiscountType::Percentage,
            discountVal: '5',
        );

        $restored = CartLine::fromArray($original->toArray());

        $this->assertSame($original->id, $restored->id);
        $this->assertSame($original->quantity->value, $restored->quantity->value);
        $this->assertSame($original->unitPrice->amount, $restored->unitPrice->amount);
        $this->assertSame($original->lineTotal->amount, $restored->lineTotal->amount);
        $this->assertSame(DiscountType::Percentage, $restored->discountType);
    }

    public function test_from_array_handles_null_discount(): void
    {
        $line = CartLine::fromArray([
            'id' => 'uuid-x',
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
