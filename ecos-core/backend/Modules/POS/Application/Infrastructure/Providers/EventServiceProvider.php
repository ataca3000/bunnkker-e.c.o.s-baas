<?php

declare(strict_types=1);

namespace Modules\POS\Application\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\POS\Application\Contracts\AccountingPortInterface;
use Modules\POS\Application\Contracts\OrderCreationPortInterface;
use Modules\POS\Application\Contracts\StockIssuePortInterface;
use Modules\POS\Application\Events\SaleFinalized;
use Modules\POS\Application\Infrastructure\Adapters\CommerceOrderCreationAdapter;
use Modules\POS\Application\Infrastructure\Adapters\DirectStockIssueAdapter;
use Modules\POS\Application\Infrastructure\Adapters\EnterpriseBusAccountingAdapter;
use Modules\POS\Application\Listeners\PosAccountingListener;
use Modules\POS\Application\Listeners\PosAnalyticsListener;
use Modules\POS\Application\Listeners\PosCustomerListener;
use Modules\POS\Application\Listeners\PosLoyaltyListener;
use Modules\POS\Application\Listeners\PosNotificationListener;
use Modules\POS\Application\Listeners\PosSaleInventoryListener;
use Modules\POS\Application\Listeners\PosSaleOrderListener;
use Modules\POS\Application\Listeners\PosWebhookListener;

/**
 * Registers all POS domain-event listeners.
 *
 * Pattern mirrors Modules\Inventory\DomainEvents\Infrastructure\Providers\DomainEventServiceProvider.
 * One listener per consuming module (ADR-006 §Listener Strategy).
 *
 * Port → Adapter bindings follow the hexagonal-architecture contract:
 *   StockIssuePortInterface     → DirectStockIssueAdapter     (wraps DirectIssueStockAction)
 *   OrderCreationPortInterface  → CommerceOrderCreationAdapter (wraps CreateOrderAction)
 *   AccountingPortInterface     → EnterpriseBusAccountingAdapter (delegates to the enterprise bus)
 *
 * SaleFinalized listeners (all synchronous — Phase B will add queue dispatch):
 *   PosSaleInventoryListener  — Subscriber 1: CRIT-003, decrements stock (no DB reload)
 *   PosSaleOrderListener      — Subscriber 2: CRIT-004, creates ERP order (no DB reload)
 *   PosAccountingListener     — Subscriber 3: posts ledger entry via AccountingPortInterface
 *   PosCustomerListener       — Subscriber 4: upserts pos_customer_stats (idempotent)
 *   PosLoyaltyListener        — Subscriber 5: awards loyalty points (config-gated)
 *   PosAnalyticsListener      — Subscriber 6: writes pos_analytics_events (insertOrIgnore)
 *   PosNotificationListener   — Subscriber 7: large-sale alerts + low-stock indicators
 *   PosWebhookListener        — Subscriber 8: dispatches DispatchWebhookJob per endpoint
 */
final class EventServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(StockIssuePortInterface::class, DirectStockIssueAdapter::class);
        $this->app->bind(OrderCreationPortInterface::class, CommerceOrderCreationAdapter::class);
        // EPIC-EVENTBUS-001: the port now delegates to the enterprise bus instead
        // of bypassing it, so POS keeps no accounting pipeline of its own. The
        // null adapter it replaces was a placeholder "until the Accounting
        // module ships" — it has since shipped.
        $this->app->bind(AccountingPortInterface::class, EnterpriseBusAccountingAdapter::class);
    }

    public function boot(): void
    {
        $events = $this->app->make('events');

        $events->listen(SaleFinalized::class, PosSaleInventoryListener::class);
        $events->listen(SaleFinalized::class, PosSaleOrderListener::class);
        $events->listen(SaleFinalized::class, PosAccountingListener::class);
        $events->listen(SaleFinalized::class, PosCustomerListener::class);
        $events->listen(SaleFinalized::class, PosLoyaltyListener::class);
        $events->listen(SaleFinalized::class, PosAnalyticsListener::class);
        $events->listen(SaleFinalized::class, PosNotificationListener::class);
        $events->listen(SaleFinalized::class, PosWebhookListener::class);
    }
}
