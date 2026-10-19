<?php

declare(strict_types=1);

namespace Modules\MasterData\Warehouses\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use InvalidArgumentException;
use Modules\MasterData\Warehouses\Application\DTO\WarehouseDTO;
use Modules\MasterData\Warehouses\Domain\Contracts\WarehouseRepositoryInterface;
use Modules\MasterData\Warehouses\Domain\Exceptions\WarehouseNotFoundException;

/**
 * Updates an existing warehouse. Code and company are immutable after creation.
 */
final class UpdateWarehouseAction extends BaseAction
{
    public function __construct(private readonly WarehouseRepositoryInterface $warehouses) {}

    /**
     * @param  mixed  ...$arguments  Expects (string $id, WarehouseDTO $dto).
     *
     * @throws WarehouseNotFoundException
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');
        $dto = $arguments[1] ?? null;

        if (! $dto instanceof WarehouseDTO) {
            throw new InvalidArgumentException('UpdateWarehouseAction::execute expects a WarehouseDTO.');
        }

        $warehouse = $this->warehouses->findById($id);

        if ($warehouse === null) {
            throw new WarehouseNotFoundException;
        }

        // Strip immutable fields — code and company_id cannot change after creation.
        $attributes = array_diff_key($dto->toArray(), array_flip(['code', 'company_id']));

        $warehouse = $this->warehouses->update($warehouse, $attributes);

        return OperationResult::success($warehouse, 'Warehouse updated successfully.');
    }
}
