<?php

declare(strict_types=1);

namespace Modules\MasterData\Warehouses\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\MasterData\Warehouses\Domain\Contracts\WarehouseRepositoryInterface;
use Modules\MasterData\Warehouses\Domain\Exceptions\WarehouseNotFoundException;

/**
 * Soft-deletes a warehouse.
 */
final class DeleteWarehouseAction extends BaseAction
{
    public function __construct(private readonly WarehouseRepositoryInterface $warehouses) {}

    /**
     * @param  mixed  ...$arguments  Expects the warehouse id (string).
     *
     * @throws WarehouseNotFoundException
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');

        $warehouse = $this->warehouses->findById($id);

        if ($warehouse === null) {
            throw new WarehouseNotFoundException;
        }

        $this->warehouses->delete($warehouse);

        return OperationResult::success(null, 'Warehouse deleted successfully.');
    }
}
