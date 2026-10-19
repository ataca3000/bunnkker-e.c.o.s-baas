<?php

declare(strict_types=1);

namespace Modules\Inventory\Products\Domain\Enums;

use Modules\Inventory\Products\Domain\Exceptions\UnknownInventoryClassException;

/**
 * The accounting classification of stock (EPIC-FIN-INTEGRATION-002/003).
 *
 * ┌─ WHY THIS EXISTS ───────────────────────────────────────────────────────┐
 * │ Finance posts inventory movements to a different GL account per class —  │
 * │ 1420 Raw Materials, 1440 Packaging, 1410 Finished Goods. It may never    │
 * │ query Inventory to find out which, so the class has to travel ON the     │
 * │ event. This enum is the vocabulary that travels.                         │
 * │                                                                          │
 * │ Product.product_type is the source of truth; this is its typed form at   │
 * │ the boundary. It deliberately adds NO new classification — a drift test  │
 * │ pins these cases to Product::TYPES so the two can never diverge.         │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * WORK IN PROGRESS IS ABSENT ON PURPOSE. WIP is not a kind of product, it is a
 * state a product passes through while being manufactured. Its account (1430) is
 * driven by which manufacturing event occurred — consumption debits it,
 * completion credits it — never by what a stock item is. Adding a WIP case here
 * would invite code to ask a product whether it is "in progress", which is not a
 * question a product can answer.
 */
enum InventoryClass: string
{
    case RawMaterial = 'raw_material';
    case PackagingMaterial = 'packaging_material';
    case FinishedGood = 'finished_good';

    /**
     * Resolve a product_type into a class, or refuse.
     *
     * There is no default and no inference. An unrecognised or missing type
     * means the product is not classifiable for accounting, and the only honest
     * outcome is to stop: a guessed class posts real money to the wrong account
     * and nothing about it looks wrong afterwards. Failing here surfaces as an
     * unpostable event, which is recoverable; a wrong account is not.
     */
    public static function fromProductType(?string $productType, ?string $productId = null): self
    {
        $resolved = $productType === null ? null : self::tryFrom($productType);

        if ($resolved === null) {
            throw UnknownInventoryClassException::forProductType($productType, $productId);
        }

        return $resolved;
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c): string => $c->value, self::cases());
    }
}
