<?php

declare(strict_types=1);

namespace Modules\MasterData\Warehouses\Domain\Exceptions;

use App\Core\Exceptions\BusinessException;

/**
 * Thrown when a warehouse cannot be found. Maps to HTTP 404.
 */
final class WarehouseNotFoundException extends BusinessException
{
    public function __construct()
    {
        parent::__construct('Warehouse not found.', [], 404);
    }
}
