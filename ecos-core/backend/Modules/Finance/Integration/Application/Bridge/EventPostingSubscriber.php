<?php

declare(strict_types=1);

namespace Modules\Finance\Integration\Application\Bridge;

use Modules\Finance\Integration\Application\Jobs\ProcessFinancialEventJob;
use Modules\Finance\Integration\Application\Services\FinancialIntegrationService;

/**
 * The bridge subscriber: it receives an operational domain event from the
 * enterprise bus, translates it through the catalog, and hands the resulting
 * FinancialEvent to the integration service.
 *
 * ┌─ ZERO COUPLING · SAFE-BY-DEFAULT ───────────────────────────────────────┐
 * │ It reads the event purely through the marker contract (eventName /         │
 * │ eventId / toArray) via duck typing, so Finance imports NO operational      │
 * │ class. It is registered on the bus only when finance.integration           │
 * │ .auto_subscribe is enabled — off by default, so wiring it up is a          │
 * │ deliberate per-environment decision once account roles are mapped, and     │
 * │ existing behaviour is unchanged until then. A translation it cannot value  │
 * │ is dropped, never guessed.                                                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class EventPostingSubscriber
{
    public function __construct(
        private readonly EventPostingCatalog $catalog,
        private readonly FinancialIntegrationService $integration,
    ) {}

    /** Enterprise-bus entry point. */
    public function handle(object $event): void
    {
        $this->consume($event);
    }

    /** Invokable form, for buses that call subscribers as callables. */
    public function __invoke(object $event): void
    {
        $this->consume($event);
    }

    /**
     * Translate and enqueue. Returns whether a financial event was produced —
     * handy for tests and for the sync path.
     */
    public function consume(object $event): bool
    {
        $name = $this->call($event, 'eventName');
        $id = $this->call($event, 'eventId');
        if ($name === null || $id === null) {
            return false;
        }

        $payload = $this->payload($event);
        $financial = $this->catalog->translate($name, $id, $payload);
        if ($financial === null) {
            return false; // not mapped or not valuable — Finance takes no action
        }

        // Async by default: the operational transaction is never blocked or
        // rolled back by a posting failure.
        ProcessFinancialEventJob::dispatch($financial);

        return true;
    }

    /** Synchronous variant used by tests and by callers that want the outcome. */
    public function consumeSync(object $event): ?string
    {
        $name = $this->call($event, 'eventName');
        $id = $this->call($event, 'eventId');
        if ($name === null || $id === null) {
            return null;
        }

        $financial = $this->catalog->translate($name, $id, $this->payload($event));
        if ($financial === null) {
            return null;
        }

        return $this->integration->record($financial)->result->value;
    }

    private function call(object $event, string $method): ?string
    {
        if (method_exists($event, $method)) {
            $value = $event->{$method}();

            return $value === null ? null : (string) $value;
        }

        return null;
    }

    /** @return array<string, mixed> */
    private function payload(object $event): array
    {
        if (method_exists($event, 'toArray')) {
            $data = $event->toArray();
            // Some events nest their data under a "payload" key.
            if (isset($data['payload']) && is_array($data['payload'])) {
                return $data['payload'] + $data;
            }

            return is_array($data) ? $data : [];
        }

        return get_object_vars($event);
    }
}
