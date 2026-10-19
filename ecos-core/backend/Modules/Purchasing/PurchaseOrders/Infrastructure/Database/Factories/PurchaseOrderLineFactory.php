<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseOrders\Infrastructure\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Purchasing\PurchaseOrders\Domain\Models\PurchaseOrder;
use Modules\Purchasing\PurchaseOrders\Domain\Models\PurchaseOrderLine;

/**
 * @extends Factory<PurchaseOrderLine>
 */
final class PurchaseOrderLineFactory extends Factory
{
    /** @var class-string<PurchaseOrderLine> */
    protected $model = PurchaseOrderLine::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        $qty = $this->faker->randomFloat(2, 1, 200);
        $price = $this->faker->randomFloat(2, 5, 500);

        return [
            'purchase_order_id' => PurchaseOrder::factory(),
            'product_id' => Product::factory(),
            'description' => $this->faker->optional()->sentence(4),
            'quantity' => $qty,
            'received_qty' => 0,
            'unit_price' => $price,
            'line_total' => round($qty * $price, 2),
        ];
    }
}
