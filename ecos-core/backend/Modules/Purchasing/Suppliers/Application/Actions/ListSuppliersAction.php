<?php

declare(strict_types=1);

namespace Modules\Purchasing\Suppliers\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Purchasing\Suppliers\Domain\Contracts\SupplierRepositoryInterface;

/**
 * Returns a paginated, filtered, sorted list of suppliers.
 */
final class ListSuppliersAction extends BaseAction
{
    public function __construct(private readonly SupplierRepositoryInterface $suppliers) {}

    /**
     * @param  mixed  ...$arguments  Expects an array<string, mixed> of filters.
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        /** @var array<string, mixed> $filters */
        $filters = is_array($arguments[0] ?? null) ? $arguments[0] : [];

        return OperationResult::success($this->suppliers->paginate($filters));
    }
}
