<?php

declare(strict_types=1);

namespace Modules\Inventory\Transfer\Domain\Exceptions;

use RuntimeException;

final class SameWarehouseTransferException extends RuntimeException
{
    public function __construct(string $warehouseId)
    {
        parent::__construct(
            "Source and destination warehouse are identical [{$warehouseId}]. Transfer requires two distinct warehouses.",
        );
    }
}
