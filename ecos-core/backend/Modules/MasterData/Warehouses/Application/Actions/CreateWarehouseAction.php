<?php

declare(strict_types=1);

namespace Modules\MasterData\Warehouses\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use InvalidArgumentException;
use Modules\MasterData\Warehouses\Application\DTO\WarehouseDTO;
use Modules\MasterData\Warehouses\Domain\Contracts\WarehouseRepositoryInterface;
use Modules\MasterData\Warehouses\Domain\Services\WarehouseCodeGeneratorService;

/**
 * Creates a new warehouse with an auto-generated code if none is provided.
 */
final class CreateWarehouseAction extends BaseAction
{
    public function __construct(
        private readonly WarehouseRepositoryInterface $warehouses,
        private readonly WarehouseCodeGeneratorService $codeGenerator,
    ) {}

    /**
     * @param  mixed  ...$arguments  Expects a single {@see WarehouseDTO}.
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        $dto = $arguments[0] ?? null;

        if (! $dto instanceof WarehouseDTO) {
            throw new InvalidArgumentException('CreateWarehouseAction::execute expects a WarehouseDTO.');
        }

        $code = $dto->code ?? $this->codeGenerator->next($dto->company_id);

        $warehouse = $this->warehouses->create(array_merge($dto->toArray(), ['code' => $code]));

        return OperationResult::success($warehouse, 'Warehouse created successfully.');
    }
}
