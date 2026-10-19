<?php

declare(strict_types=1);

namespace Modules\Inventory\Transfer\Domain\Exceptions;

use RuntimeException;

final class InactiveWarehouseException extends RuntimeException
{
    public function __construct(string $warehouseId, string $role = 'warehouse')
    {
        parent::__construct(
            "Transfer rejected: {$role} [{$warehouseId}] is inactive. Activate the warehouse before transferring stock.",
        );
    }
}
