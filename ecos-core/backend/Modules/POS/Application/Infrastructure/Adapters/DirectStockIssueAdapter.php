<?php

declare(strict_types=1);

namespace Modules\POS\Application\Infrastructure\Adapters;

use App\Core\Responses\OperationResult;
use Modules\Inventory\InventoryItems\Application\Actions\DirectIssueStockAction;
use Modules\Inventory\InventoryItems\Application\DTO\StockOperationDTO;
use Modules\POS\Application\Contracts\StockIssuePortInterface;

/**
 * Adapter: wraps Inventory's DirectIssueStockAction behind StockIssuePortInterface.
 *
 * The POS listener depends on the port; this adapter is the production binding.
 */
final class DirectStockIssueAdapter implements StockIssuePortInterface
{
    public function __construct(private readonly DirectIssueStockAction $action) {}

    public function issue(StockOperationDTO $dto): OperationResult
    {
        return $this->action->execute($dto);
    }
}
