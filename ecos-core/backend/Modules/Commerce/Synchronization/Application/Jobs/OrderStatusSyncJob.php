<?php

declare(strict_types=1);

namespace Modules\Commerce\Synchronization\Application\Jobs;

use BackedEnum;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Synchronization\Application\Services\SyncLogService;
use Modules\Commerce\Synchronization\Domain\Enums\SyncDirection;
use Modules\Commerce\Synchronization\Domain\Enums\SyncEntityType;
use Modules\Commerce\Synchronization\Domain\Enums\SyncStatus;
use Throwable;

/**
 * Pushes an ECOS order status change to WooCommerce.
 *
 * Dispatched by OrderObserver when an order with a known external_order_id
 * has its status changed. Maps ECOS OrderStatus values to WooCommerce status slugs.
 */
final class OrderStatusSyncJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 60;

    private const STATUS_MAP = [
        'pending' => 'pending',
        'processing' => 'processing',
        'completed' => 'completed',
        'cancelled' => 'cancelled',
    ];

    public function __construct(
        private readonly Channel $channel,
        private readonly Order $order,
    ) {}

    public function handle(SyncLogService $logService): void
    {
        $log = $logService->createLog(
            $this->channel,
            SyncEntityType::Order,
            SyncDirection::Outbound,
            'order.status_sync',
            $this->order->id,
            SyncStatus::Processing,
            [
                'order_id' => $this->order->id,
                'external_order_id' => $this->order->external_order_id,
                'status' => $this->order->status instanceof BackedEnum
                    ? $this->order->status->value
                    : (string) $this->order->status,
            ],
        );

        $credential = $this->channel->credential;

        if ($credential === null) {
            $logService->markFailed($log, 'No credentials configured for this channel.', null, $this->channel);

            return;
        }

        $externalId = $this->order->external_order_id;

        if ($externalId === null || $externalId === '') {
            $logService->markFailed($log, 'Order has no external_order_id.', null, $this->channel);

            return;
        }

        $statusValue = $this->order->status instanceof BackedEnum
            ? $this->order->status->value
            : (string) $this->order->status;

        $wooStatus = self::STATUS_MAP[$statusValue] ?? null;

        if ($wooStatus === null) {
            $logService->markFailed($log, "No WooCommerce mapping for status [{$statusValue}].", null, $this->channel);

            return;
        }

        try {
            $response = Http::withBasicAuth($credential->consumer_key, $credential->consumer_secret)
                ->timeout(15)
                ->put(
                    rtrim($this->channel->store_url, '/').'/wp-json/wc/v3/orders/'.$externalId,
                    ['status' => $wooStatus],
                );

            if ($response->successful()) {
                $logService->markSuccess($log, ['woo_status' => $wooStatus, 'http_status' => $response->status()], $this->channel);
            } else {
                $logService->markFailed(
                    $log,
                    "HTTP {$response->status()}: ".mb_substr($response->body(), 0, 500),
                    null,
                    $this->channel,
                );
            }
        } catch (Throwable $e) {
            $logService->markFailed($log, $e->getMessage(), null, $this->channel);
            throw $e;
        }
    }
}
