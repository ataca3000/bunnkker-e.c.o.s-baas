<?php

declare(strict_types=1);

namespace Modules\Inventory\DomainEvents\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Commerce\Synchronization\Application\Listeners\InventoryChannelSynchronizationListener;
use Modules\Inventory\DomainEvents\Contracts\DomainEventBus;
use Modules\Inventory\DomainEvents\Events\InventoryCountApproved;
use Modules\Inventory\DomainEvents\Events\InventoryStockAdjusted;
use Modules\Inventory\DomainEvents\Events\InventoryStockReceived;
use Modules\Inventory\DomainEvents\Events\InventoryStockReleased;
use Modules\Inventory\DomainEvents\Events\InventoryStockReserved;
use Modules\Inventory\DomainEvents\Events\InventoryStockShipped;
use Modules\Inventory\DomainEvents\Infrastructure\Bus\LaravelDomainEventBus;

/**
 * Registers the Domain Event infrastructure.
 *
 * Phase A (Shadow Mode):
 *   - Binds DomainEventBus → LaravelDomainEventBus
 *   - Registers InventoryChannelSynchronizationListener for all 6 events
 *   - Listener logs only — no queue dispatch, no WooCommerce API
 *
 * Phase B will add InventorySyncJob dispatch inside the listener.
 * Phase C will remove StockMovementObserver.
 *
 * Transfer events (InventoryTransferred, WarehouseTransferCompleted):
 *   These events are published by TransferStockAction but have no listener here.
 *   This is intentional in Phase A — see ADR-026 (docs/adr/ADR-026-transfer-events-phase-b.md).
 *   Listeners will be added in Phase B once InventoryChannelSynchronizationListener
 *   is upgraded to queue-dispatch to avoid blocking the transfer request thread.
 */
final class DomainEventServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(DomainEventBus::class, LaravelDomainEventBus::class);
    }

    public function boot(): void
    {
        $events = $this->app->make('events');

        // All 6 canonical inventory events → single responsibility listener.
        // One listener per module (ADR-006 §Listener Strategy), not one per event.
        $events->listen(InventoryStockReceived::class, InventoryChannelSynchronizationListener::class);
        $events->listen(InventoryStockReserved::class, InventoryChannelSynchronizationListener::class);
        $events->listen(InventoryStockReleased::class, InventoryChannelSynchronizationListener::class);
        $events->listen(InventoryStockShipped::class, InventoryChannelSynchronizationListener::class);
        $events->listen(InventoryStockAdjusted::class, InventoryChannelSynchronizationListener::class);
        $events->listen(InventoryCountApproved::class, InventoryChannelSynchronizationListener::class);
    }
}
