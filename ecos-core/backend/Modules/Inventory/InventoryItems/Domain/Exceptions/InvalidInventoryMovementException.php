<?php

declare(strict_types=1);

namespace Modules\Inventory\InventoryItems\Domain\Exceptions;

use App\Core\Exceptions\BusinessException;

final class InvalidInventoryMovementException extends BusinessException
{
    public function __construct(string $reason)
    {
        parent::__construct(
            message: "Invalid inventory movement: {$reason}.",
            errors: ['reason' => $reason],
            statusCode: 422,
        );
    }
}
