<?php

declare(strict_types=1);

namespace Modules\Inventory\StockLedger\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Inventory\StockLedger\Domain\Contracts\StockMovementRepositoryInterface;

final class ListStockMovementsAction extends BaseAction
{
    public function __construct(private readonly StockMovementRepositoryInterface $movements) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $filters = is_array($arguments[0] ?? null) ? $arguments[0] : [];

        return OperationResult::success($this->movements->paginate($filters));
    }
}
