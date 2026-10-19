<?php

declare(strict_types=1);

namespace Modules\Purchasing\GoodsReceipts\Infrastructure\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Purchasing\GoodsReceipts\Domain\Enums\GoodsReceiptStatus;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceipt;
use Modules\Purchasing\PurchaseOrders\Domain\Models\PurchaseOrder;

/**
 * @extends Factory<GoodsReceipt>
 */
final class GoodsReceiptFactory extends Factory
{
    /** @var class-string<GoodsReceipt> */
    protected $model = GoodsReceipt::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'receipt_number' => 'GR-'.str_pad((string) $this->faker->unique()->numberBetween(1, 99999), 5, '0', STR_PAD_LEFT),
            'purchase_order_id' => PurchaseOrder::factory()->approved(),
            'warehouse_id' => Warehouse::factory(),
            'receipt_date' => now()->toDateString(),
            'status' => GoodsReceiptStatus::Draft->value,
        ];
    }

    public function posted(): self
    {
        return $this->state(fn (): array => [
            'status' => GoodsReceiptStatus::Posted->value,
            'posted_at' => now(),
        ]);
    }
}
