<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Infrastructure\Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Orders\Domain\Models\OrderLine;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Sales\Customers\Domain\Models\Customer;

final class OrderSeeder extends Seeder
{
    public function run(): void
    {
        if (Order::query()->where('order_number', 'ORD-00001')->exists()) {
            return;
        }

        $customer = Customer::query()->where('name', 'Cairo Retail')->first();
        $channel = Channel::query()->where('name', 'ECOS Main Store')->first();
        $product = Product::query()->where('product_type', 'finished_good')->first();

        if ($customer === null || $product === null) {
            $this->command->warn('OrderSeeder: Cairo Retail customer or a finished_good product not found — skipping.');

            return;
        }

        $quantity = 5;
        $unitPrice = 299.00;
        $lineTotal = $quantity * $unitPrice;

        /** @var Order $order */
        $order = Order::query()->create([
            'order_number' => 'ORD-00001',
            'channel_id' => $channel?->id,
            'customer_id' => $customer->id,
            'external_order_id' => null,
            'order_date' => now()->toDateString(),
            'status' => OrderStatus::NewOrder->value,
            'subtotal' => $lineTotal,
            'total' => $lineTotal,
            'notes' => 'Sample order created by seeder.',
        ]);

        OrderLine::query()->create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'quantity' => $quantity,
            'unit_price' => $unitPrice,
            'line_total' => $lineTotal,
        ]);
    }
}
