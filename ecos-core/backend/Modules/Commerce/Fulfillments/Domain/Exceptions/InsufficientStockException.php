<?php

declare(strict_types=1);

namespace Modules\Commerce\Fulfillments\Domain\Exceptions;

use RuntimeException;

final class InsufficientStockException extends RuntimeException
{
    public function __construct(string $productId, float $available, float $required)
    {
        parent::__construct(
            "Insufficient stock for product [{$productId}]: available {$available}, required {$required}.",
        );
    }
}
