<?php

declare(strict_types=1);

namespace Modules\POS\Application\Infrastructure\Adapters;

use Modules\POS\Application\Contracts\AccountingPortInterface;
use Modules\POS\Application\Events\SaleFinalized;
use Modules\Platform\EventPlatform\Application\Services\EnterpriseEventBus;

/**
 * POS → enterprise event transport (EPIC-EVENTBUS-001).
 *
 * ┌─ WHY THIS REPLACES THE NULL ADAPTER ────────────────────────────────────┐
 * │ POS published its events through Laravel's dispatcher and routed         │
 * │ accounting through this port, which was bound to a no-op "until the      │
 * │ Accounting module ships". Finance meanwhile subscribes on the enterprise │
 * │ bus. So a POS sale was published, complete with company, warehouse,      │
 * │ currency and totals, already mapped in EventPostingCatalog — and never   │
 * │ reached Finance, because the two sides were on different transports.     │
 * │                                                                          │
 * │ The Accounting module has since shipped. This adapter is what the null   │
 * │ one was a placeholder for: the port now DELEGATES to the enterprise bus  │
 * │ rather than bypassing it, so POS gains no accounting pipeline of its own.│
 * │ Finance, audit, analytics and anything else that subscribes see the same │
 * │ event, once.                                                             │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * The port is kept rather than retired because it is POS's seam for "something
 * downstream cares about this sale". Retiring it would push knowledge of the bus
 * into ProcessSaleService, which is the coupling the port exists to prevent.
 *
 * SINGLE PUBLISH PATH: the sale reaches the bus here and only here. POS still
 * dispatches its Laravel event for its own listeners; this adapter is the one
 * enterprise-integration boundary, so no consumer receives the sale twice.
 */
final class EnterpriseBusAccountingAdapter implements AccountingPortInterface
{
    public function __construct(private readonly EnterpriseEventBus $bus) {}

    public function recordSale(SaleFinalized $event): void
    {
        // Published as-is. The event already carries every value Finance needs,
        // so nothing is enriched, derived or looked up on the way through.
        $this->bus->publish($event);
    }
}
