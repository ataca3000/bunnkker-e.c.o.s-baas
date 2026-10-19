<?php

declare(strict_types=1);

namespace Modules\Purchasing\Suppliers\Domain\Exceptions;

use App\Core\Exceptions\BusinessException;

/**
 * Thrown when a supplier cannot be found. Maps to HTTP 404.
 */
final class SupplierNotFoundException extends BusinessException
{
    public function __construct()
    {
        parent::__construct('Supplier not found.', [], 404);
    }
}
