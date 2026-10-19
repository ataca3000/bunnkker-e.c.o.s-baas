<?php

declare(strict_types=1);

namespace Modules\Commerce\Synchronization\Application\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Commerce\OrderImport\Application\Services\WooCommerceOrderImporter;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Synchronization\Application\Services\SyncLogService;
use Modules\Commerce\Synchronization\Application\Services\WooCommerceOrderStatusTranslator;
use Modules\Commerce\Synchronization\Domain\Enums\SyncDirection;
use Modules\Commerce\Synchronization\Domain\Enums\SyncEntityType;
use Modules\Commerce\Synchronization\Domain\Enums\SyncStatus;
use Modules\Operations\Fulfillment\Application\FulfillmentEngine;
use Modules\Operations\Fulfillment\Application\Workflows\CancelOrderWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\CompleteDeliveryWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\ProcessOrderWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\ReturnOrderWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\SetEarlyStatusWorkflow;
use Throwable;

/**
 * Processes an inbound WooCommerce order webhook (created/updated/deleted).
 *
 * P5 fix: replaced the inline status map and parallel inventory pipeline with
 * the canonical WooCommerceOrderStatusTranslator + FulfillmentEngine routing.
 * - ONE status translation map (WooCommerceOrderStatusTranslator)
 * - ONE inventory pipeline (via FulfillmentEngine workflows)
 * - withoutEvents() removed — domain events now fire normally
 *
 * Guard failures are non-fatal: if ECOS and WC are out of sync, the webhook
 * logs a warning and skips the transition rather than crashing.
 */
final class ProcessOrderWebhookJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 30;

    /** @param array<string, mixed> $payload */
    public function __construct(
        private readonly Channel $channel,
        private readonly array $payload,
        private readonly string $webhookAction,
    ) {}

    public function handle(
        SyncLogService $logService,
        WooCommerceOrderImporter $importer,
        WooCommerceOrderStatusTranslator $translator,
        FulfillmentEngine $fulfillmentEngine,
        ProcessOrderWorkflow $processWorkflow,
        CancelOrderWorkflow $cancelWorkflow,
        CompleteDeliveryWorkflow $deliverWorkflow,
        ReturnOrderWorkflow $returnWorkflow,
        SetEarlyStatusWorkflow $earlyStatusWorkflow,
    ): void {
        $externalId = (string) ($this->payload['id'] ?? '');

        $log = $logService->createLog(
            $this->channel,
            SyncEntityType::Order,
            SyncDirection::Inbound,
            $this->webhookAction,
            $externalId,
            SyncStatus::Processing,
            $this->payload,
        );

        try {
            $existingOrder = $externalId !== ''
                ? Order::query()
                    ->where('external_order_id', $externalId)
                    ->where('channel_id', $this->channel->id)
                    ->first()
                : null;

            if ($existingOrder !== null) {
                $wooStatus = (string) ($this->payload['status'] ?? '');
                $ecosStatus = $translator->translate($wooStatus);

                if ($ecosStatus !== null && $ecosStatus !== $existingOrder->status) {
                    // Route through the appropriate canonical workflow.
                    // Guard failures are skipped — WC/ECOS state divergence is expected
                    // when orders are managed in ECOS outside the WC lifecycle.
                    $workflow = match (true) {
                        // 'refunded' maps to 'returned' per the translator — must NOT use cancelWorkflow.
                        // ReturnOrderWorkflow::guard() will fail non-fatally for orders not yet OutForDelivery;
                        // the catch below handles that gracefully.
                        $wooStatus === 'refunded' => $returnWorkflow,
                        in_array($wooStatus, ['cancelled', 'failed'], true) => $cancelWorkflow,
                        $wooStatus === 'processing' => $processWorkflow,
                        $wooStatus === 'completed' => $deliverWorkflow,
                        default => $earlyStatusWorkflow,
                    };

                    try {
                        $fulfillmentEngine->run(
                            $workflow,
                            $existingOrder,
                            ['target_status' => $ecosStatus->value, 'reason' => "WooCommerce webhook: {$wooStatus}"],
                            null, // system actor
                        );
                    } catch (Throwable $workflowError) {
                        // Non-fatal: guard failure or state mismatch — log and continue.
                        \Illuminate\Support\Facades\Log::warning('[WcWebhook] Workflow guard rejected status transition', [
                            'order_id' => $existingOrder->id,
                            'wc_status' => $wooStatus,
                            'ecos_from' => $existingOrder->status->value,
                            'ecos_to' => $ecosStatus->value,
                            'error' => $workflowError->getMessage(),
                        ]);
                    }
                }

                $logService->markSuccess($log, ['message' => 'Order status processed.', 'order_id' => $existingOrder->id], $this->channel);
            } else {
                $created = $importer->importSingle($this->channel, $this->payload);
                $logService->markSuccess(
                    $log,
                    ['message' => $created ? 'Order created.' : 'Order skipped (no valid lines).'],
                    $created ? $this->channel : null,
                );
            }
        } catch (Throwable $e) {
            $logService->markFailed($log, $e->getMessage(), null, $this->channel);
            throw $e;
        }
    }
}
