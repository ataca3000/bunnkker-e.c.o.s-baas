<?php

declare(strict_types=1);

namespace Modules\Inventory\Products\Domain\Exceptions;

use App\Core\Exceptions\BusinessException;

/**
 * Thrown when a product cannot be found. Maps to HTTP 404.
 */
final class ProductNotFoundException extends BusinessException
{
    public function __construct()
    {
        parent::__construct('Product not found.', [], 404);
    }
}
