<?php

declare(strict_types=1);

namespace Modules\Finance\Posting\Domain\Contracts;

use Modules\Finance\Ledger\Domain\ValueObjects\PostingRequest;

/**
 * The seam every subledger posts through.
 *
 * ┌─ ONE STRATEGY PER EVENT KIND (F3), ONE CONTRACT FOREVER ────────────────┐
 * │ A strategy translates a business context into a BALANCED PostingRequest  │
 * │ and hands it back. It resolves accounts and amounts; it does NOT write   │
 * │ the ledger — the Journal Engine does. Inventory, Manufacturing, Sales,   │
 * │ Procurement, POS, Shipping and Marketing accounting each become a        │
 * │ strategy in F3, plugging in behind this interface with no change to the  │
 * │ posting core (the Strategy pattern, exactly as routing/carriers did in   │
 * │ Logistics V2).                                                           │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
interface PostingStrategyInterface
{
    /** Which event type this strategy knows how to post. */
    public function supports(string $eventType): bool;

    /**
     * Build the balanced journal request for a business context.
     *
     * @param  array<string, mixed>  $context
     */
    public function build(string $eventType, array $context): PostingRequest;
}
