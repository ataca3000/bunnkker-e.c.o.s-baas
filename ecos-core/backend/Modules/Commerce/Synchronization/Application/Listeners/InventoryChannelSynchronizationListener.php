<?php

declare(strict_types=1);

namespace Modules\Commerce\Synchronization\Application\Listeners;

use Illuminate\Support\Facades\Log;
use Modules\Commerce\Synchronization\Application\Services\ChannelSynchronizationService;
use Modules\Inventory\DomainEvents\Contracts\DomainEvent;

/**
 * Phase B — Active listener that delegates to ChannelSynchronizationService.
 *
 * Responsibilities (ADR-006 §Listener Strategy):
 *   ✓  Validate that base event payload fields are present
 *   ✓  Identify session-level events (no product_id) and pass them through — the
 *      service decides whether to dispatch or no-op
 *   ✓  Delegate to ChannelSynchronizationService for all sync orchestration
 *   ✗  No channel lookup
 *   ✗  No mapping logic
 *   ✗  No queue dispatch (owned by the service)
 *   ✗  No WooCommerce API calls
 *
 * Dual-run guarantee (Phase B):
 *   StockMovementObserver REMAINS registered and continues dispatching InventorySyncJob
 *   for paths that still create StockMovement records.  Both pipelines are active
 *   simultaneously.  InventorySyncJob is idempotent (absolute-quantity PUT) so
 *   duplicate dispatch is safe.
 *
 * ADR-006 §Listener Strategy: one listener per module, typed to DomainEvent.
 */
final class InventoryChannelSynchronizationListener
{
    /**
     * Fields every inventory domain event payload must carry.
     * product_id is intentionally excluded — session-level events
     * (e.g. inventory.count.approved) carry no product_id by design.
     */
    private const REQUIRED_FIELDS = [
        'event_id',
        'event_name',
        'occurred_at',
    ];

    /**
     * Event names that are session-scoped and do not carry a product_id.
     * These pass validation even when product-scoped fields are absent.
     */
    private const SESSION_EVENT_NAMES = [
        'inventory.count.approved',
    ];

    public function __construct(
        private readonly ChannelSynchronizationService $syncService,
    ) {}

    public function handle(DomainEvent $event): void
    {
        $payload = $event->toArray();

        $missing = $this->validatePayload($payload);

        if ($missing !== []) {
            // Session events may be missing product-scoped fields — that is expected.
            // Only warn (and return early) when truly required base fields are absent.
            Log::channel('daily')->warning('[DomainEvent][PhaseB] Inventory event received with missing required fields', [
                'event_id' => $event->eventId(),
                'event_name' => $event->eventName(),
                'correlation_id' => $event->correlationId(),
                'missing_fields' => $missing,
            ]);

            return;
        }

        // Delegate ALL orchestration to the service.
        // The service is responsible for deciding whether to dispatch a job
        // (it no-ops gracefully for session-level events without product_id).
        $this->syncService->handleEvent($event);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Validate that required base fields are present and non-empty.
     *
     * @param  array<string, mixed>  $payload
     * @return list<string> missing field names
     */
    private function validatePayload(array $payload): array
    {
        $missing = [];

        foreach (self::REQUIRED_FIELDS as $field) {
            if (! isset($payload[$field]) || $payload[$field] === '' || $payload[$field] === null) {
                $missing[] = $field;
            }
        }

        return $missing;
    }
}
