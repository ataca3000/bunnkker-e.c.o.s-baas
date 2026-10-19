<?php

declare(strict_types=1);

namespace Modules\Inventory\InventoryItems\Domain\Exceptions;

use App\Core\Exceptions\BusinessException;

final class InsufficientStockException extends BusinessException
{
    public function __construct(
        string $productId,
        string $warehouseId,
        float $requested,
        float $available,
    ) {
        parent::__construct(
            message: "Insufficient stock: requested {$requested}, available {$available}.",
            errors: [
                'product_id' => $productId,
                'warehouse_id' => $warehouseId,
                'requested' => $requested,
                'available' => $available,
            ],
            statusCode: 422,
        );
    }
}
