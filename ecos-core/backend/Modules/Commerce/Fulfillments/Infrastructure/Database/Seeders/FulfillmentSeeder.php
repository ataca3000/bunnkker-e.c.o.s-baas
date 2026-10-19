<?php

declare(strict_types=1);

namespace Modules\Commerce\Fulfillments\Infrastructure\Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\Commerce\Fulfillments\Domain\Enums\FulfillmentStatus;
use Modules\Commerce\Fulfillments\Domain\Models\Fulfillment;
use Modules\Commerce\Fulfillments\Domain\Models\FulfillmentLine;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;

final class FulfillmentSeeder extends Seeder
{
    public function run(): void
    {
        if (Fulfillment::query()->where('fulfillment_number', 'FUL-00001')->exists()) {
            return;
        }

        $order = Order::query()->where('order_number', 'ORD-00001')->first();
        $warehouse = Warehouse::query()->where('name', 'like', '%Main%')->first()
            ?? Warehouse::query()->first();

        if ($order === null || $warehouse === null) {
            $this->command->warn('FulfillmentSeeder: ORD-00001 or a warehouse not found — skipping.');

            return;
        }

        /** @var Fulfillment $fulfillment */
        $fulfillment = Fulfillment::query()->create([
            'fulfillment_number' => 'FUL-00001',
            'order_id' => $order->id,
            'warehouse_id' => $warehouse->id,
            'fulfillment_date' => now()->toDateString(),
            'status' => FulfillmentStatus::Pending->value,
            'notes' => 'Sample fulfillment created by seeder.',
        ]);

        foreach ($order->lines as $line) {
            FulfillmentLine::query()->create([
                'fulfillment_id' => $fulfillment->id,
                'product_id' => $line->product_id,
                'quantity' => $line->quantity,
            ]);
        }
    }
}
