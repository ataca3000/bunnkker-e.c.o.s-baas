<?php

declare(strict_types=1);

namespace Modules\MasterData\Warehouses\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\MasterData\Warehouses\Domain\Contracts\WarehouseRepositoryInterface;

/**
 * Returns a paginated, filtered, sorted list of warehouses.
 */
final class ListWarehousesAction extends BaseAction
{
    public function __construct(private readonly WarehouseRepositoryInterface $warehouses) {}

    /**
     * @param  mixed  ...$arguments  Expects an array<string, mixed> of filters.
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        /** @var array<string, mixed> $filters */
        $filters = is_array($arguments[0] ?? null) ? $arguments[0] : [];

        return OperationResult::success($this->warehouses->paginate($filters));
    }
}
