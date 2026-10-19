<?php

declare(strict_types=1);

namespace Modules\Inventory\StockLedger\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Inventory\StockLedger\Domain\Contracts\StockMovementRepositoryInterface;
use Modules\Inventory\StockLedger\Domain\Exceptions\StockMovementNotFoundException;

final class GetStockMovementAction extends BaseAction
{
    public function __construct(private readonly StockMovementRepositoryInterface $movements) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');
        $movement = $this->movements->findById($id);

        if ($movement === null) {
            throw new StockMovementNotFoundException($id);
        }

        return OperationResult::success($movement);
    }
}
