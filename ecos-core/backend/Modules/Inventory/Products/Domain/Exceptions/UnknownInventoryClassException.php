<?php

declare(strict_types=1);

namespace Modules\Inventory\Products\Domain\Exceptions;

use DomainException;
use Modules\Inventory\Products\Domain\Enums\InventoryClass;

/**
 * Raised when a product cannot be classified for accounting.
 *
 * This is deliberately a hard failure. The alternative — defaulting to some
 * class — moves stock value onto an account nobody chose, silently and
 * permanently. The message names the offending value and the product so the
 * fix is a data correction, not an investigation.
 */
final class UnknownInventoryClassException extends DomainException
{
    public static function forProductType(?string $productType, ?string $productId = null): self
    {
        $seen = $productType === null || $productType === ''
            ? 'no product_type'
            : sprintf('product_type "%s"', $productType);

        return new self(sprintf(
            'Cannot classify %s for inventory accounting: %s is not one of [%s]. %s',
            $productId === null ? 'product' : sprintf('product %s', $productId),
            $seen,
            implode(', ', InventoryClass::values()),
            'Correct the product classification before this stock movement can post.',
        ));
    }
}
