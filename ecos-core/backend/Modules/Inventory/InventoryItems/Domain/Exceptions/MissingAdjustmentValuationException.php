<?php

declare(strict_types=1);

namespace Modules\Inventory\InventoryItems\Domain\Exceptions;

use DomainException;

/**
 * Raised when stock is adjusted UPWARDS without a stated value.
 *
 * ┌─ WHY AN INCREASE MUST BE PRICED BY A HUMAN ─────────────────────────────┐
 * │ Every other stock movement has a price the system can know: a receipt    │
 * │ has an invoice, an issue consumes a layer that was bought at a price.    │
 * │ An upward adjustment has neither — the stock appears from nowhere, so    │
 * │ there is no transaction to read a value from.                            │
 * │                                                                          │
 * │ Reaching for average or FIFO cost here would look like an answer while   │
 * │ being a guess: it values new stock at what OTHER stock happened to cost. │
 * │ That guess is then debited to a real asset account and inflates the      │
 * │ balance sheet silently. So the platform refuses, and asks the person     │
 * │ recording the adjustment what it is worth.                               │
 * │                                                                          │
 * │ Approved as Decision 2 of EPIC-FIN-INTEGRATION-003A.                     │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class MissingAdjustmentValuationException extends DomainException
{
    public static function forProduct(string $productId): self
    {
        return new self(sprintf(
            'Stock increase for product %s was rejected: no valuation was supplied. '
            .'Provide a unit cost or a total value — an upward adjustment has no purchase '
            .'behind it, so its value cannot be derived and will never be assumed.',
            $productId,
        ));
    }
}
