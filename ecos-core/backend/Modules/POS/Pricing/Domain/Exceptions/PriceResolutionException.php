<?php

declare(strict_types=1);

namespace Modules\POS\Pricing\Domain\Exceptions;

use DomainException;

final class PriceResolutionException extends DomainException
{
    public static function productNotFound(string $productId): self
    {
        return new self("Product '{$productId}' was not found in the pricing system.");
    }

    public static function noPriceSet(string $productId): self
    {
        return new self("Product '{$productId}' has no price configured.");
    }

    public static function productInactive(string $productId): self
    {
        return new self("Product '{$productId}' is inactive and cannot be priced.");
    }

    public static function invalidPrice(string $productId, string $detail): self
    {
        return new self("Invalid price for product '{$productId}': {$detail}");
    }
}
