<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use BackedEnum;
use GuzzleHttp\TransferStats;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Modules\Commerce\Orders\Application\Services\CreateOrderSnapshotService;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Orders\Domain\Models\OrderEvent;
use Modules\Operations\Fulfillment\Application\FulfillmentEngine;
use Modules\Operations\Fulfillment\Application\Workflows\CancelOrderWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\CompleteDeliveryWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\DispatchOrderWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\MarkAwaitingStockWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\MoveToPreparationWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\MoveToReviewWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\ProcessOrderWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\ReturnOrderWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\ReturnToPendingWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\SetEarlyStatusWorkflow;
use Modules\Operations\Fulfillment\Domain\Contracts\FulfillmentWorkflowInterface;
use Throwable;

/**
 * Applies a partial field update to an order.
 *
 * Used exclusively for inline grid edits (area, status, location).
 * Full order updates continue to use UpdateOrderAction.
 *
 * P4 fix: removed the VALID_TRANSITIONS duplicate state machine. Status transitions
 * now resolve to a FulfillmentWorkflowInterface and route through FulfillmentEngine::run().
 * Non-status field updates (area, zone, location) remain direct updates — they carry
 * no inventory or audit consequences beyond field logging.
 */
final class PatchOrderAction extends BaseAction
{
    private const ALLOWED = ['status', 'area', 'city', 'governorate', 'google_maps_lat', 'google_maps_lng', 'google_maps_url', 'delivery_zone_id', 'delivery_zone'];

    /** InProgress is the first committed state — trigger snapshot on entry. */
    private const SNAPSHOT_TRIGGER_STATUSES = ['in_progress'];

    public function __construct(
        private readonly CreateOrderSnapshotService $snapshotService,
        private readonly FulfillmentEngine $fulfillmentEngine,
        // Workflow pool — resolved via Laravel container for each status target.
        private readonly ProcessOrderWorkflow $processWorkflow,
        private readonly MoveToPreparationWorkflow $prepareWorkflow,
        private readonly DispatchOrderWorkflow $dispatchWorkflow,
        private readonly CompleteDeliveryWorkflow $deliverWorkflow,
        private readonly CancelOrderWorkflow $cancelWorkflow,
        private readonly MarkAwaitingStockWorkflow $awaitingStockWorkflow,
        private readonly ReturnToPendingWorkflow $pendingWorkflow,
        private readonly ReturnOrderWorkflow $returnOrderWorkflow,
        private readonly MoveToReviewWorkflow $reviewWorkflow,
        private readonly SetEarlyStatusWorkflow $earlyStatusWorkflow,
    ) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) $arguments[0];
        $data = (array) $arguments[1];

        /** @var Order $order */
        $order = Order::where('id', $id)
            ->where('company_id', Auth::user()?->company_id)
            ->firstOrFail();
        $update = array_intersect_key($data, array_flip(self::ALLOWED));

        // Auto-resolve short Google Maps URLs and extract coordinates server-side.
        if (! empty($update['google_maps_url']) && ! isset($update['google_maps_lat'])) {
            $urlHost = strtolower((string) parse_url($update['google_maps_url'], PHP_URL_HOST));
            if (str_contains($urlHost, 'maps.app.goo.gl')) {
                [$resolvedUrl, $lat, $lng] = $this->resolveShortMapsUrl($update['google_maps_url']);
                $update['google_maps_url'] = $resolvedUrl;
                if ($lat !== null) {
                    $update['google_maps_lat'] = $lat;
                    $update['google_maps_lng'] = $lng;
                }
            }
        }

        $actorId = Auth::id() !== null ? (string) Auth::id() : null;
        $actorName = Auth::user()?->name ?? null;
        $actorEmail = Auth::user()?->email ?? null;
        $actorRole = Auth::user()?->roles()->value('name');
        $reason = $data['reason'] ?? null;

        // ── Status transition (routes through FulfillmentEngine) ──────────────────

        if (isset($update['status'])) {
            $newStatusValue = $update['status'] instanceof BackedEnum
                ? $update['status']->value
                : (string) $update['status'];

            $workflow = $this->resolveWorkflow($order->status, $newStatusValue, $data);

            if ($workflow === null) {
                abort(422, "No fulfillment workflow found for transition from '{$order->status->value}' to '{$newStatusValue}'. Use the dedicated fulfillment endpoint.");
            }

            // Apply non-status field changes first (zone, governorate, etc.)
            $nonStatusUpdate = array_filter(
                $update,
                static fn ($key) => $key !== 'status',
                ARRAY_FILTER_USE_KEY,
            );

            if (! empty($nonStatusUpdate)) {
                $oldValues = [];
                foreach (array_keys($nonStatusUpdate) as $field) {
                    $oldValues[$field] = $order->getAttribute($field);
                }

                $order->update($nonStatusUpdate);

                foreach ($nonStatusUpdate as $field => $newValue) {
                    $oldValue = $oldValues[$field] ?? null;
                    $oldStr = $oldValue instanceof BackedEnum ? $oldValue->value : $oldValue;
                    $newStr = $newValue instanceof BackedEnum ? $newValue->value : $newValue;
                    if ((string) $oldStr !== (string) ($newStr ?? '')) {
                        OrderEvent::log(
                            orderId: $order->id,
                            type: 'field_updated',
                            description: "Field '{$field}' updated.",
                            payload: ['field' => $field, 'old_value' => $oldStr, 'new_value' => $newStr],
                            actorId: $actorId,
                            actorName: $actorName,
                        );
                    }
                }
            }

            // Delegate status transition to the canonical fulfillment pipeline.
            // Pass target_status so SetEarlyStatusWorkflow can read it from context.
            try {
                $result = $this->fulfillmentEngine->run(
                    $workflow,
                    $order->fresh(),
                    ['reason' => $reason, 'target_status' => $newStatusValue, ...$data],
                    $actorId,
                );
                $order = $result->order;
            } catch (Throwable $e) {
                Log::channel('daily')->warning('[PatchOrder] Workflow failed', [
                    'order_id' => $order->id,
                    'to' => $newStatusValue,
                    'error' => $e->getMessage(),
                ]);
                abort(422, $e->getMessage());
            }

            if (in_array($order->status->value, self::SNAPSHOT_TRIGGER_STATUSES, true)) {
                $this->snapshotService->createIfAbsent($order);
            }

            $order->load(['customer', 'lines.product.unit', 'channel']);

            return OperationResult::success($order, 'Order updated.');
        }

        // ── Non-status field patch (area, zone, location) ─────────────────────────

        $oldValues = [];
        foreach (array_keys($update) as $field) {
            $oldValues[$field] = $order->getAttribute($field);
        }

        if (! empty($update)) {
            $order->update($update);
        }

        foreach ($update as $field => $newValue) {
            $oldValue = $oldValues[$field] ?? null;
            $oldStr = $oldValue instanceof BackedEnum ? $oldValue->value : $oldValue;
            $newStr = $newValue instanceof BackedEnum ? $newValue->value : $newValue;

            if ((string) $oldStr !== (string) ($newStr ?? '')) {
                OrderEvent::log(
                    orderId: $order->id,
                    type: 'field_updated',
                    description: "Field '{$field}' updated.",
                    payload: ['field' => $field, 'old_value' => $oldStr, 'new_value' => $newStr],
                    actorId: $actorId,
                    actorName: $actorName,
                    previousValue: [$field => $oldStr],
                    newValue: [$field => $newStr],
                    actionType: 'updated',
                    actorRole: $actorRole,
                    actorEmail: $actorEmail,
                );
            }
        }

        $order->load(['customer', 'lines.product.unit', 'channel']);

        return OperationResult::success($order, 'Order updated.');
    }

    /**
     * Map (from_status, to_status) to the canonical workflow.
     * The workflow's own guard() validates the source state — this resolver just
     * provides the correct semantic match based on both source and target.
     */
    private function resolveWorkflow(OrderStatus $from, string $to, array $data): ?FulfillmentWorkflowInterface
    {
        return match (true) {
            // Inventory-impacting transitions
            $to === OrderStatus::InProgress->value       => $this->processWorkflow,
            $to === OrderStatus::ReadyForDispatch->value => $this->prepareWorkflow,
            $to === OrderStatus::OutForDelivery->value   => $this->dispatchWorkflow,
            $to === OrderStatus::Delivered->value        => $this->deliverWorkflow,
            $to === OrderStatus::Cancelled->value        => $this->cancelWorkflow,
            $to === OrderStatus::AwaitingStock->value    => $this->awaitingStockWorkflow,
            $to === OrderStatus::NewOrder->value         => $this->pendingWorkflow,
            $to === OrderStatus::Returned->value         => $this->returnOrderWorkflow,
            $to === OrderStatus::OnHold->value           => $this->reviewWorkflow,

            // Simple label-only transitions (no inventory impact)
            $to === OrderStatus::AwaitingPayment->value,
            $to === OrderStatus::Scheduled->value        => $this->earlyStatusWorkflow,

            default => null,
        };
    }

    /** @return array{string, float|null, float|null} */
    private function resolveShortMapsUrl(string $url): array
    {
        $finalUrl = $url;
        try {
            Http::withOptions([
                'allow_redirects' => ['max' => 10],
                'on_stats' => function (TransferStats $stats) use (&$finalUrl): void {
                    $finalUrl = (string) $stats->getEffectiveUri();
                },
            ])->withHeaders(['User-Agent' => 'Mozilla/5.0 (compatible; ECOS/1.0)'])
                ->timeout(8)
                ->head($url);
        } catch (Throwable) {
            // Network or resolution failure — return the original URL unchanged.
        }

        $lat = $lng = null;
        // Priority 1: !3d<lat>!4d<lng> — the actual place-pin in Google Maps Place URLs.
        if (preg_match('/!3d(-?\d+\.?\d+)!4d(-?\d+\.?\d+)/', $finalUrl, $m)) {
            $candidate = [(float) $m[1], (float) $m[2]];
            if ($candidate[0] >= -90 && $candidate[0] <= 90 && $candidate[1] >= -180 && $candidate[1] <= 180) {
                [$lat, $lng] = $candidate;
            }
        }

        if ($lat === null) {
            if (preg_match('/@(-?\d+\.?\d*),(-?\d+\.?\d*)/', $finalUrl, $m)) {
                $lat = (float) $m[1];
                $lng = (float) $m[2];
            } elseif (preg_match('/[?&]q=(-?\d+\.?\d*)[,+](-?\d+\.?\d*)/', $finalUrl, $m)) {
                $lat = (float) $m[1];
                $lng = (float) $m[2];
            } elseif (preg_match('/\/maps\/search\/(-?\d+\.?\d*)[,+\s]+(-?\d+\.?\d*)/', $finalUrl, $m)) {
                $lat = (float) $m[1];
                $lng = (float) $m[2];
            }
        }

        return [$finalUrl, $lat, $lng];
    }
}
