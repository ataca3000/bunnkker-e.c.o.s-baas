<?php

declare(strict_types=1);

namespace Modules\Commerce\Synchronization\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Synchronization\Application\Jobs\CustomerSyncJob;
use Modules\Commerce\Synchronization\Application\Jobs\InventorySyncJob;
use Modules\Commerce\Synchronization\Application\Jobs\OrderStatusSyncJob;
use Modules\Commerce\Synchronization\Application\Jobs\PriceSyncJob;
use Modules\Commerce\Synchronization\Application\Jobs\ProcessCustomerWebhookJob;
use Modules\Commerce\Synchronization\Application\Jobs\ProcessOrderWebhookJob;
use Modules\Commerce\Synchronization\Application\Jobs\ProcessProductWebhookJob;
use Modules\Commerce\Synchronization\Application\Jobs\ProductSyncJob;
use Modules\Commerce\Synchronization\Domain\Enums\SyncDirection;
use Modules\Commerce\Synchronization\Domain\Enums\SyncEntityType;
use Modules\Commerce\Synchronization\Domain\Models\SyncLog;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Purchasing\GoodsReceipts\Domain\Models\StockBalance;
use Modules\Sales\Customers\Domain\Models\Customer;

final class RetrySyncLogAction extends BaseAction
{
    /**
     * Arguments:
     *   [0] SyncLog $log
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        /** @var SyncLog $log */
        $log = $arguments[0];

        $channel = $log->channel;

        if ($channel === null) {
            return OperationResult::failure('Channel no longer exists.');
        }

        return $log->direction === SyncDirection::Outbound
            ? $this->retryOutbound($log, $channel)
            : $this->retryInbound($log, $channel);
    }

    private function retryOutbound(SyncLog $log, Channel $channel): OperationResult
    {
        if ($log->entity_id === null) {
            return OperationResult::failure('Cannot retry: no entity ID recorded.');
        }

        switch ($log->entity_type) {
            case SyncEntityType::Product:
            case SyncEntityType::Price:
            case SyncEntityType::Inventory:
                $product = Product::find($log->entity_id);
                if ($product === null) {
                    return OperationResult::failure('Product no longer exists.');
                }
                match ($log->entity_type) {
                    SyncEntityType::Product => ProductSyncJob::dispatch($channel, $product),
                    SyncEntityType::Price => PriceSyncJob::dispatch($channel, $product),
                    SyncEntityType::Inventory => InventorySyncJob::dispatch(
                        $channel,
                        $product,
                        (float) StockBalance::query()->where('product_id', $product->id)->sum('quantity'),
                    ),
                    default => null,
                };
                break;

            case SyncEntityType::Customer:
                $customer = Customer::find($log->entity_id);
                if ($customer === null) {
                    return OperationResult::failure('Customer no longer exists.');
                }
                CustomerSyncJob::dispatch($channel, $customer);
                break;

            case SyncEntityType::Order:
                $order = Order::find($log->entity_id);
                if ($order === null) {
                    return OperationResult::failure('Order no longer exists.');
                }
                if ($order->external_order_id === null) {
                    return OperationResult::failure('Order has no external_order_id, cannot sync status.');
                }
                OrderStatusSyncJob::dispatch($channel, $order);
                break;

            default:
                return OperationResult::failure("Entity type [{$log->entity_type->value}] does not support outbound retry.");
        }

        return OperationResult::success(null, 'Retry job dispatched successfully.');
    }

    private function retryInbound(SyncLog $log, Channel $channel): OperationResult
    {
        $payload = is_array($log->request_payload) ? $log->request_payload : [];
        $action = (string) ($log->action ?? '');

        switch ($log->entity_type) {
            case SyncEntityType::Product:
                ProcessProductWebhookJob::dispatch($channel, $payload, $action);
                break;

            case SyncEntityType::Customer:
                ProcessCustomerWebhookJob::dispatch($channel, $payload, $action);
                break;

            case SyncEntityType::Order:
                ProcessOrderWebhookJob::dispatch($channel, $payload, $action);
                break;

            default:
                return OperationResult::failure("Entity type [{$log->entity_type->value}] does not support inbound retry.");
        }

        return OperationResult::success(null, 'Retry job dispatched successfully.');
    }
}
