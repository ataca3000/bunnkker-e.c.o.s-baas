<?php

declare(strict_types=1);

namespace Modules\POS\Application\Contracts;

use Modules\POS\Application\Events\SaleFinalized;

/**
 * Port: the POS application layer's contract for recording a completed sale
 * in the accounting system.
 *
 * Decouples the POS listener from any concrete accounting implementation,
 * enabling independent testing and future swap when an Accounting module exists.
 *
 * Pattern mirrors StockIssuePortInterface / OrderCreationPortInterface.
 */
interface AccountingPortInterface
{
    /**
     * Record a completed POS sale as an accounting entry.
     * Implementations must be idempotent (safe to call more than once for the same sale).
     */
    public function recordSale(SaleFinalized $event): void;
}
