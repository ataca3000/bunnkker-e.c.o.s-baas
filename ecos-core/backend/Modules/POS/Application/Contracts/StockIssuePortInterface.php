<?php

declare(strict_types=1);

namespace Modules\POS\Application\Contracts;

use App\Core\Responses\OperationResult;
use Modules\Inventory\InventoryItems\Application\DTO\StockOperationDTO;

/**
 * Port: the POS application layer's contract for issuing (decrementing) stock.
 *
 * Decouples the POS listener from the concrete DirectIssueStockAction,
 * enabling independent testing and future swap (e.g. queued adapter).
 */
interface StockIssuePortInterface
{
    public function issue(StockOperationDTO $dto): OperationResult;
}
