<?php

declare(strict_types=1);

namespace Modules\Inventory\InventoryItems\Domain\Exceptions;

use App\Core\Exceptions\BusinessException;

final class NegativeInventoryException extends BusinessException
{
    public function __construct(string $field, float $wouldBecome)
    {
        parent::__construct(
            message: "Operation would reduce {$field} below zero (would become {$wouldBecome}).",
            errors: ['field' => $field, 'would_become' => $wouldBecome],
            statusCode: 422,
        );
    }
}
