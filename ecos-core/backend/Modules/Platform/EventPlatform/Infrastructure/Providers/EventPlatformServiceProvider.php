<?php

declare(strict_types=1);

namespace Modules\Platform\EventPlatform\Infrastructure\Providers;

use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use Modules\Crm\Customers\Domain\Events\CustomerArchived;
use Modules\Crm\Customers\Domain\Events\CustomerCreated;
use Modules\Crm\Customers\Domain\Events\CustomerMerged;
use Modules\Crm\Customers\Domain\Events\CustomerRestored;
use Modules\Crm\Customers\Domain\Events\CustomerUpdated;
use Modules\Crm\Sales\Domain\Events\LeadConverted;
use Modules\Crm\Sales\Domain\Events\LeadCreated;
use Modules\Crm\Sales\Domain\Events\LeadLost;
use Modules\Crm\Sales\Domain\Events\LeadQualified;
use Modules\Crm\Sales\Domain\Events\OpportunityCreated;
use Modules\Crm\Sales\Domain\Events\OpportunityLost;
use Modules\Crm\Sales\Domain\Events\OpportunityUpdated;
use Modules\Crm\Sales\Domain\Events\OpportunityWon;
use Modules\Crm\Sales\Domain\Events\QuoteApproved;
use Modules\Crm\Sales\Domain\Events\QuoteCreated;
use Modules\Crm\Sales\Domain\Events\QuoteRejected;
use Modules\Crm\Loyalty\Domain\Events\LoyaltyPointsEarned;
use Modules\Crm\Loyalty\Domain\Events\LoyaltyPointsRedeemed;
use Modules\Inventory\DomainEvents\Events\InventoryCountApproved;
use Modules\Inventory\DomainEvents\Events\InventoryStockAdjusted;
use Modules\Inventory\DomainEvents\Events\InventoryStockReceived;
use Modules\Inventory\DomainEvents\Events\InventoryStockReleased;
use Modules\Inventory\DomainEvents\Events\InventoryStockReserved;
use Modules\Inventory\DomainEvents\Events\InventoryStockShipped;
use Modules\Operations\DemandAnalysis\Application\Listeners\DemandRefreshRequestedListener;
use Modules\Operations\DemandAnalysis\Application\Listeners\GoodsReceiptCompletedListener;
use Modules\Operations\DemandAnalysis\Application\Listeners\InventoryReturnedListener;
use Modules\Operations\DemandAnalysis\Application\Listeners\ManufacturingCompletedListener;
use Modules\Operations\DemandAnalysis\Application\Listeners\OrderAddedToWaveListener;
use Modules\Operations\DemandAnalysis\Application\Listeners\OrderMovedToPreparingListener;
use Modules\Operations\DemandAnalysis\Application\Listeners\OrderRemovedFromWaveListener;
use Modules\Operations\DemandAnalysis\Application\Listeners\WaveClosedListener;
use Modules\Operations\DemandAnalysis\Application\Listeners\WaveCreatedListener;
use Modules\Operations\Preparation\Application\Events\Inbound\ManufacturingJobCompletedEvent;
use Modules\Operations\Preparation\Domain\Events\DemandRefreshRequested;
use Modules\Operations\Preparation\Domain\Events\OrderAddedToWave;
use Modules\Operations\Preparation\Domain\Events\OrderMovedToPreparing;
use Modules\Operations\Preparation\Domain\Events\OrderRemovedFromWave;
use Modules\Operations\Preparation\Domain\Events\WaveClosed;
use Modules\Operations\Preparation\Domain\Events\WaveCreated;
use Modules\Platform\EventPlatform\Application\Services\EnterpriseEventBus;
use Modules\Platform\EventPlatform\Application\Services\EnterpriseEventDispatcher;
use Modules\Platform\EventPlatform\Application\Services\EnterpriseEventMonitor;
use Modules\Platform\EventPlatform\Application\Services\EnterpriseEventPublisher;
use Modules\Platform\EventPlatform\Application\Services\EnterpriseEventRegistry;
use Modules\Platform\EventPlatform\Application\Services\EnterpriseEventReplayService;
use Modules\Platform\EventPlatform\Application\Services\EnterpriseEventSerializer;
use Modules\Platform\EventPlatform\Domain\Contracts\EnterpriseDeadLetterQueueInterface;
use Modules\Platform\EventPlatform\Domain\Contracts\EnterpriseEventBusInterface;
use Modules\Platform\EventPlatform\Domain\Contracts\EnterpriseEventRegistryInterface;
use Modules\Platform\EventPlatform\Domain\Contracts\EnterpriseEventStoreInterface;
use Modules\Platform\EventPlatform\Domain\ValueObjects\RetryPolicy;
use Modules\Platform\EventPlatform\Infrastructure\Repositories\EloquentDeadLetterQueueRepository;
use Modules\Platform\EventPlatform\Infrastructure\Repositories\EloquentEventStore;
use Modules\Platform\EventPlatform\Presentation\Console\DrainDlqCommand;
use Modules\Platform\EventPlatform\Presentation\Console\EventMonitorCommand;
use Modules\Platform\EventPlatform\Presentation\Console\ReplayEventsCommand;

final class EventPlatformServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // ── Core infrastructure singletons ────────────────────────────────────
        $this->app->singleton(EnterpriseEventSerializer::class);
        $this->app->singleton(EnterpriseEventRegistry::class);

        $this->app->singleton(EnterpriseEventStoreInterface::class, EloquentEventStore::class);
        $this->app->singleton(EnterpriseEventRegistryInterface::class, EnterpriseEventRegistry::class);
        $this->app->singleton(EnterpriseDeadLetterQueueInterface::class, EloquentDeadLetterQueueRepository::class);

        $this->app->singleton(EnterpriseEventDispatcher::class);
        $this->app->singleton(EnterpriseEventPublisher::class);
        $this->app->singleton(EnterpriseEventReplayService::class);
        $this->app->singleton(EnterpriseEventMonitor::class);

        $this->app->singleton(EnterpriseEventBus::class);
        $this->app->singleton(EnterpriseEventBusInterface::class, EnterpriseEventBus::class);

        // DomainEventBus is deliberately NOT rebound here.
        //
        // This provider loads after DomainEventServiceProvider, so binding
        // DomainEventBus to EnterpriseEventBus silently overrode
        // LaravelDomainEventBus. Inventory actions then published straight into
        // EnterpriseEventPublisher, which routes through EnterpriseEventDispatcher
        // and never touches Illuminate's dispatcher — so the six
        // InventoryChannelSynchronizationListener registrations in
        // DomainEventServiceProvider::boot() could never fire, and no enterprise
        // subscriber was registered for those events either (see the commented-out
        // inventory.goods_receipt.completed line below). The events reached the
        // store and were routed to nothing.
        //
        // The platform's own pattern is the reverse: modules dispatch through
        // Laravel, and bridgeLegacyEvents() republishes into the enterprise bus
        // for the event store. Inventory now follows that same pattern.
    }

    public function boot(): void
    {
        /** @var EnterpriseEventBus $bus */
        $bus = $this->app->make(EnterpriseEventBus::class);

        // ── Register Demand Engine subscribers ───────────────────────────────
        $this->registerDemandEngineSubscribers($bus);

        // ── Bridge: route legacy Dispatchable events into the enterprise bus ─
        // When WaveCreated::dispatch() fires, the bus receives it, persists it
        // to the event store, and routes to subscribers via HandleEnterpriseEventJob.
        $this->bridgeLegacyEvents($bus);

        // ── Console commands ──────────────────────────────────────────────────
        if ($this->app->runningInConsole()) {
            $this->commands([
                ReplayEventsCommand::class,
                DrainDlqCommand::class,
                EventMonitorCommand::class,
            ]);
        }
    }

    private function registerDemandEngineSubscribers(EnterpriseEventBus $bus): void
    {
        $bus->subscribe('preparation.wave.created', WaveCreatedListener::class, RetryPolicy::standard(), priority: 10, queue: 'demand');
        $bus->subscribe('preparation.wave.closed', WaveClosedListener::class, RetryPolicy::standard(), priority: 10, queue: 'demand');
        $bus->subscribe('preparation.wave.demand_refresh_requested', DemandRefreshRequestedListener::class, RetryPolicy::standard(), priority: 10, queue: 'demand');
        $bus->subscribe('preparation.wave.order_added', OrderAddedToWaveListener::class, RetryPolicy::standard(), priority: 10, queue: 'demand');
        $bus->subscribe('preparation.wave.order_removed', OrderRemovedFromWaveListener::class, RetryPolicy::standard(), priority: 10, queue: 'demand');
        $bus->subscribe('preparation.wave.order_moved_to_preparing', OrderMovedToPreparingListener::class, RetryPolicy::standard(), priority: 10, queue: 'demand');
        $bus->subscribe('manufacturing.production_job.completed', ManufacturingCompletedListener::class, RetryPolicy::standard(), priority: 10, queue: 'demand');
        // GoodsReceiptCompleted and InventoryReturned: listeners are ready; wire once events are available.
        // $bus->subscribe('inventory.goods_receipt.completed', GoodsReceiptCompletedListener::class, RetryPolicy::standard(), priority: 10, queue: 'demand');
        // $bus->subscribe('inventory.returned',                InventoryReturnedListener::class,     RetryPolicy::standard(), priority: 10, queue: 'demand');
    }

    /**
     * Bridge legacy DomainEvent dispatches into the Enterprise Event Platform.
     *
     * Existing code calls WaveCreated::dispatch(...) which fires via Laravel's Dispatchable trait.
     * These closures intercept those dispatches and route them through the enterprise bus,
     * which stores them and delivers to subscribers via HandleEnterpriseEventJob.
     *
     * No existing call sites need to change.
     */
    private function bridgeLegacyEvents(EnterpriseEventBus $bus): void
    {
        Event::listen(WaveCreated::class, fn (WaveCreated $e) => $bus->publish($e));
        Event::listen(WaveClosed::class, fn (WaveClosed $e) => $bus->publish($e));
        Event::listen(DemandRefreshRequested::class, fn (DemandRefreshRequested $e) => $bus->publish($e));
        Event::listen(OrderAddedToWave::class, fn (OrderAddedToWave $e) => $bus->publish($e));
        Event::listen(OrderRemovedFromWave::class, fn (OrderRemovedFromWave $e) => $bus->publish($e));
        Event::listen(OrderMovedToPreparing::class, fn (OrderMovedToPreparing $e) => $bus->publish($e));

        // Inventory domain events. These dispatch through LaravelDomainEventBus so
        // DomainEventServiceProvider's listeners run; bridging them here keeps the
        // event store complete without a second dispatch — the bus receives each
        // event as a subscriber, exactly as it does for the wave events above.
        Event::listen(InventoryStockReceived::class, fn (InventoryStockReceived $e) => $bus->publish($e));
        Event::listen(InventoryStockReserved::class, fn (InventoryStockReserved $e) => $bus->publish($e));
        Event::listen(InventoryStockReleased::class, fn (InventoryStockReleased $e) => $bus->publish($e));
        Event::listen(InventoryStockShipped::class, fn (InventoryStockShipped $e) => $bus->publish($e));
        Event::listen(InventoryStockAdjusted::class, fn (InventoryStockAdjusted $e) => $bus->publish($e));
        Event::listen(InventoryCountApproved::class, fn (InventoryCountApproved $e) => $bus->publish($e));

        // InventoryTransferred is deliberately NOT bridged here. ADR-026 defers
        // any transfer consumer to Phase B: a synchronous listener would couple
        // warehouse-transfer latency to this bus, breaking the performance
        // contract of TransferStockAction. EPIC-FIN-INTEGRATION-004 added one
        // and OperationsIntegrationFinalCertTest caught it.
        //
        // The Finance side is ready — inventory.warehouse_transfer has a rule, a
        // mapped role, a complete payload and a catalog entry. Registering the
        // listener is a Phase B work item, not a Finance one.

        // CRM customer and sales lifecycle (EPIC-CRM-EVENTS-001B).
        Event::listen(CustomerArchived::class, fn (CustomerArchived $e) => $bus->publish($e));
        Event::listen(CustomerCreated::class, fn (CustomerCreated $e) => $bus->publish($e));
        Event::listen(CustomerMerged::class, fn (CustomerMerged $e) => $bus->publish($e));
        Event::listen(CustomerRestored::class, fn (CustomerRestored $e) => $bus->publish($e));
        Event::listen(CustomerUpdated::class, fn (CustomerUpdated $e) => $bus->publish($e));
        Event::listen(LeadConverted::class, fn (LeadConverted $e) => $bus->publish($e));
        Event::listen(LeadCreated::class, fn (LeadCreated $e) => $bus->publish($e));
        Event::listen(LeadLost::class, fn (LeadLost $e) => $bus->publish($e));
        Event::listen(LeadQualified::class, fn (LeadQualified $e) => $bus->publish($e));
        Event::listen(OpportunityCreated::class, fn (OpportunityCreated $e) => $bus->publish($e));
        Event::listen(OpportunityLost::class, fn (OpportunityLost $e) => $bus->publish($e));
        Event::listen(OpportunityUpdated::class, fn (OpportunityUpdated $e) => $bus->publish($e));
        Event::listen(OpportunityWon::class, fn (OpportunityWon $e) => $bus->publish($e));
        Event::listen(QuoteApproved::class, fn (QuoteApproved $e) => $bus->publish($e));
        Event::listen(QuoteCreated::class, fn (QuoteCreated $e) => $bus->publish($e));
        Event::listen(QuoteRejected::class, fn (QuoteRejected $e) => $bus->publish($e));

        // CRM loyalty. Bridged the same way as the inventory events above, so
        // Finance's crm.loyalty_earn and crm.loyalty_redeem rules — which have
        // existed with nothing to fire them — finally receive an operational
        // event (EPIC-CRM-EVENTS-001).
        Event::listen(LoyaltyPointsEarned::class, fn (LoyaltyPointsEarned $e) => $bus->publish($e));
        Event::listen(LoyaltyPointsRedeemed::class, fn (LoyaltyPointsRedeemed $e) => $bus->publish($e));

        // ManufacturingJobCompletedEvent does not implement DomainEvent — keep legacy listener for now.
        // TODO: Convert ManufacturingJobCompletedEvent to a proper EnterpriseEvent when Manufacturing OS is migrated.
    }
}
