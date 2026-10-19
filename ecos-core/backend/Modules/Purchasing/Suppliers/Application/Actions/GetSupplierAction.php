<?php

declare(strict_types=1);

namespace Modules\Purchasing\Suppliers\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Purchasing\Suppliers\Domain\Contracts\SupplierRepositoryInterface;
use Modules\Purchasing\Suppliers\Domain\Exceptions\SupplierNotFoundException;

/**
 * Fetches a single supplier by id.
 */
final class GetSupplierAction extends BaseAction
{
    public function __construct(private readonly SupplierRepositoryInterface $suppliers) {}

    /**
     * @param  mixed  ...$arguments  Expects the supplier id (string).
     *
     * @throws SupplierNotFoundException
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');

        $supplier = $this->suppliers->findById($id);

        if ($supplier === null) {
            throw new SupplierNotFoundException;
        }

        return OperationResult::success($supplier);
    }
}
