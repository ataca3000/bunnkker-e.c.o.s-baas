<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Returns;

use InvalidArgumentException;
use Modules\POS\Returns\Domain\ValueObjects\ReturnLine;
use Modules\POS\Shared\Domain\Enums\ReturnReason;
use Modules\POS\Shared\Domain\ValueObjects\Quantity;
use PHPUnit\Framework\TestCase;

/**
 * PKG-POS-009: ReturnLine value object unit tests.
 * Pure unit tests — no database, no Laravel boot.
 */
final class ReturnLineTest extends TestCase
{
    private function makeSaleLineData(
        string $lineId = 'line-uuid-1',
        string $price = '50.00',
        string $currency = 'EGP',
    ): array {
        return [
            'line_id' => $lineId,
            'product_id' => 'prod-uuid-1',
            'product_name' => 'Widget',
            'sku' => 'WGT-001',
            'quantity' => '2.0000',
            'unit_price' => ['amount' => $price, 'currency' => $currency],
            'discount_type' => null,
            'discount_value' => null,
            'line_total' => ['amount' => bcmul($price, '2', 2), 'currency' => $currency],
            'sort_order' => 0,
        ];
    }

    // ── fromSaleLine() ────────────────────────────────────────────────────────

    public function test_from_sale_line_maps_line_id(): void
    {
        $line = ReturnLine::fromSaleLine(
            $this->makeSaleLineData(lineId: 'original-line-uuid'),
            Quantity::of('1'),
            ReturnReason::WrongItem,
        );
        $this->assertSame('original-line-uuid', $line->lineId);
    }

    public function test_from_sale_line_stores_product_fields(): void
    {
        $line = ReturnLine::fromSaleLine($this->makeSaleLineData(), Quantity::of('1'), ReturnReason::WrongItem);
        $this->assertSame('prod-uuid-1', $line->productId);
        $this->assertSame('Widget', $line->productName);
        $this->assertSame('WGT-001', $line->sku);
    }

    public function test_from_sale_line_stores_return_quantity(): void
    {
        $line = ReturnLine::fromSaleLine($this->makeSaleLineData(), Quantity::of('1'), ReturnReason::WrongItem);
        $this->assertSame('1.0000', $line->quantity->value);
    }

    public function test_from_sale_line_stores_unit_price_as_money(): void
    {
        $line = ReturnLine::fromSaleLine($this->makeSaleLineData(price: '75.00'), Quantity::of('1'), ReturnReason::WrongItem);
        $this->assertSame('75.00', $line->unitPrice->amount);
        $this->assertSame('EGP', $line->unitPrice->currency);
    }

    public function test_from_sale_line_calculates_refund_amount_for_quantity_one(): void
    {
        $line = ReturnLine::fromSaleLine($this->makeSaleLineData(price: '50.00'), Quantity::of('1'), ReturnReason::WrongItem);
        $this->assertSame('50.00', $line->refundAmount->amount);
    }

    public function test_from_sale_line_calculates_refund_amount_for_multiple_units(): void
    {
        $line = ReturnLine::fromSaleLine($this->makeSaleLineData(price: '25.00'), Quantity::of('3'), ReturnReason::WrongItem);
        $this->assertSame('75.00', $line->refundAmount->amount);
    }

    public function test_from_sale_line_stores_reason(): void
    {
        $line = ReturnLine::fromSaleLine($this->makeSaleLineData(), Quantity::of('1'), ReturnReason::Defective);
        $this->assertSame(ReturnReason::Defective, $line->reason);
    }

    public function test_from_sale_line_should_restock_true_for_wrong_item(): void
    {
        $line = ReturnLine::fromSaleLine($this->makeSaleLineData(), Quantity::of('1'), ReturnReason::WrongItem);
        $this->assertTrue($line->shouldRestock);
    }

    public function test_from_sale_line_should_restock_false_for_defective(): void
    {
        $line = ReturnLine::fromSaleLine($this->makeSaleLineData(), Quantity::of('1'), ReturnReason::Defective);
        $this->assertFalse($line->shouldRestock);
    }

    public function test_from_sale_line_stores_sort_order(): void
    {
        $line = ReturnLine::fromSaleLine($this->makeSaleLineData(), Quantity::of('1'), ReturnReason::WrongItem, sortOrder: 2);
        $this->assertSame(2, $line->sortOrder);
    }

    public function test_from_sale_line_throws_for_zero_quantity(): void
    {
        $this->expectException(InvalidArgumentException::class);
        ReturnLine::fromSaleLine($this->makeSaleLineData(), Quantity::of('0'), ReturnReason::WrongItem);
    }

    public function test_from_sale_line_throws_for_negative_quantity(): void
    {
        $this->expectException(InvalidArgumentException::class);
        ReturnLine::fromSaleLine($this->makeSaleLineData(), Quantity::of('-1'), ReturnReason::WrongItem);
    }

    // ── toArray() ─────────────────────────────────────────────────────────────

    public function test_to_array_contains_required_keys(): void
    {
        $array = ReturnLine::fromSaleLine($this->makeSaleLineData(), Quantity::of('1'), ReturnReason::WrongItem)->toArray();
        foreach ([
            'line_id', 'product_id', 'product_name', 'sku', 'quantity',
            'unit_price', 'refund_amount', 'reason', 'should_restock', 'sort_order',
        ] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing key: {$key}");
        }
    }

    public function test_to_array_serialises_reason_as_string(): void
    {
        $array = ReturnLine::fromSaleLine($this->makeSaleLineData(), Quantity::of('1'), ReturnReason::CustomerPreference)->toArray();
        $this->assertSame('customer_preference', $array['reason']);
    }

    public function test_to_array_serialises_refund_amount_as_nested_array(): void
    {
        $array = ReturnLine::fromSaleLine($this->makeSaleLineData(price: '30.00'), Quantity::of('2'), ReturnReason::WrongItem)->toArray();
        $this->assertIsArray($array['refund_amount']);
        $this->assertSame('60.00', $array['refund_amount']['amount']);
    }

    public function test_to_array_serialises_should_restock_as_bool(): void
    {
        $array = ReturnLine::fromSaleLine($this->makeSaleLineData(), Quantity::of('1'), ReturnReason::Defective)->toArray();
        $this->assertFalse($array['should_restock']);
    }

    // ── fromArray / roundtrip ─────────────────────────────────────────────────

    public function test_roundtrip_to_array_from_array(): void
    {
        $original = ReturnLine::fromSaleLine(
            $this->makeSaleLineData(lineId: 'line-rt', price: '40.00'),
            Quantity::of('2'),
            ReturnReason::CustomerPreference,
            sortOrder: 1,
        );

        $restored = ReturnLine::fromArray($original->toArray());

        $this->assertSame('line-rt', $restored->lineId);
        $this->assertSame('2.0000', $restored->quantity->value);
        $this->assertSame('40.00', $restored->unitPrice->amount);
        $this->assertSame('80.00', $restored->refundAmount->amount);
        $this->assertSame(ReturnReason::CustomerPreference, $restored->reason);
        $this->assertTrue($restored->shouldRestock);
        $this->assertSame(1, $restored->sortOrder);
    }

    public function test_from_array_restores_should_restock_correctly(): void
    {
        $original = ReturnLine::fromSaleLine($this->makeSaleLineData(), Quantity::of('1'), ReturnReason::Defective);
        $restored = ReturnLine::fromArray($original->toArray());
        $this->assertFalse($restored->shouldRestock);
    }
}
