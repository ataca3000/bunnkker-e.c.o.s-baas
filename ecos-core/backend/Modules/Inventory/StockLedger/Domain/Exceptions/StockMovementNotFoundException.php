<?php

declare(strict_types=1);

namespace Modules\Inventory\StockLedger\Domain\Exceptions;

use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class StockMovementNotFoundException extends NotFoundHttpException
{
    public function __construct(string $id)
    {
        parent::__construct("Stock movement [{$id}] not found.");
    }
}
