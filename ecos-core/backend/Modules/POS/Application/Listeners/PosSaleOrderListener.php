<?php

declare(strict_types=1);

namespace Modules\POS\Application\Listeners;

use Illuminate\Support\Facades\Log;
use Modules\Admin\Configuration\Domain\Services\ConfigurationManager;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Commerce\Orders\Application\DTO\OrderDTO;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\POS\Application\Contracts\OrderCreationPortInterface;
use Modules\POS\Application\Events\SaleFinalized;
use Modules\POS\Application\Events\SaleItemPayload;
use Throwable;

/**
 * CRIT-004 — Creates a standard ERP Sales Order when a POS sale completes.
 *
 * Subscriber 2 of 8. Listens to SaleFinalized (the enriched integration event).
 *
 * All context (items, customerId, channelId) is carried by the event —
 * no DB reloads are necessary. The order channel is resolved from
 * $event->channelId (null for POS, since POS is not a Commerce channel).
 *
 * Customer resolution:
 *   - Known customer: $event->customerId is used directly.
 *   - Anonymous (walk-in): falls back to config('pos.erp.guest_customer_id').
 *     If unconfigured, order creation is skipped and a warning is logged.
 *     Set POS_GUEST_CUSTOMER_ID in .env to enable order creation for walk-in sales.
 *
 * The order links back to the POS sale via external_order_id = $event->saleId,
 * enabling bidirectional traceability between the POS and commerce layers.
 *
 * The listener NEVER throws — the sale is already committed and must not roll back.
 * All failures are logged to the 'daily' channel for operational alerting.
 *
 * ADR-006 §Listener Strategy: one listener per consuming module, typed to the
 * concrete event class. No queue dispatch — Phase B will add async retry.
 */
final class PosSaleOrderListener
{
    public function __construct(
        private readonly OrderCreationPortInterface $orderCreation,
        private readonly ConfigurationManager $config,
    ) {}

    public function handle(SaleFinalized $event): void
    {
        $customerId = $event->customerId ?? config('pos.erp.guest_customer_id');

        if (empty($customerId)) {
            Log::channel('daily')->warning(
                '[POS][Order] No customer on sale and POS_GUEST_CUSTOMER_ID is not configured — order not created',
                [
                    'sale_id' => $event->saleId,
                    'receipt_number' => $event->receiptNumber,
                ],
            );

            return;
        }

        $lines = array_map(
            static fn (SaleItemPayload $item): array => [
                'product_id' => $item->productId,
                'quantity' => (float) $item->quantity,
                'unit_price' => (float) $item->unitPrice,
            ],
            $event->items,
        );

        $status = $this->resolveEntryStatus($event->channelId);

        $dto = new OrderDTO(
            customer_id: (string) $customerId,
            order_date: now()->toDateString(),
            status: $status,
            lines: $lines,
            channel_id: $event->channelId,
            external_order_id: $event->saleId,
            notes: "POS Sale #{$event->receiptNumber}",
        );

        try {
            $result = $this->orderCreation->create($dto);

            /** @var \Modules\Commerce\Orders\Domain\Models\Order|null $order */
            $order = $result->data();

            Log::channel('daily')->info('[POS][Order] ERP order created from POS sale', [
                'sale_id' => $event->saleId,
                'receipt_number' => $event->receiptNumber,
                'order_id' => $order?->id,
            ]);
        } catch (Throwable $e) {
            Log::channel('daily')->error('[POS][Order] Failed to create ERP order from POS sale', [
                'sale_id' => $event->saleId,
                'receipt_number' => $event->receiptNumber,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Reads the brand's source_entry_policies.pos to determine the order entry status.
     * Falls back to OrderStatus::Completed if channelId is null or policy lookup fails.
     */
    private function resolveEntryStatus(?string $channelId): OrderStatus
    {
        if ($channelId === null) {
            return OrderStatus::Delivered;
        }

        try {
            $channel = Channel::find($channelId);
            if ($channel === null) {
                return OrderStatus::Delivered;
            }

            $policy = $this->config->getBrandPolicy((string) $channel->brand_id, 'order');
            $statusValue = $policy['source_entry_policies']['pos'] ?? 'delivered';

            return OrderStatus::from($statusValue);
        } catch (Throwable) {
            return OrderStatus::Delivered;
        }
    }
}
