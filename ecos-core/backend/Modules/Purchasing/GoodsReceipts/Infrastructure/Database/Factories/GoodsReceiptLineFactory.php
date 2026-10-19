<?php

declare(strict_types=1);

namespace Modules\Purchasing\GoodsReceipts\Infrastructure\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceipt;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceiptLine;
use Modules\Purchasing\PurchaseOrders\Domain\Models\PurchaseOrderLine;

/**
 * @extends Factory<GoodsReceiptLine>
 */
final class GoodsReceiptLineFactory extends Factory
{
    /** @var class-string<GoodsReceiptLine> */
    protected $model = GoodsReceiptLine::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        $ordered = $this->faker->randomFloat(2, 10, 200);
        $net = $this->faker->randomFloat(2, 1, $ordered);
        $gross = $net + $this->faker->randomFloat(2, 0, 2);
        $unitPrice = $this->faker->randomFloat(2, 5, 500);

        return [
            'goods_receipt_id' => GoodsReceipt::factory(),
            'purchase_order_line_id' => PurchaseOrderLine::factory(),
            'product_id' => Product::factory(),
            'ordered_quantity' => $ordered,
            'received_quantity' => $net,
            'gross_received_quantity' => $gross,
            'net_received_quantity' => $net,
            'variance_quantity' => round($net - $ordered, 4),
            'unit_price' => $unitPrice,
        ];
    }
}
