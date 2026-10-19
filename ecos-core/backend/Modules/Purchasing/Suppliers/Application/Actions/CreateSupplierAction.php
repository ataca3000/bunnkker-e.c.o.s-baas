<?php

declare(strict_types=1);

namespace Modules\Purchasing\Suppliers\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Illuminate\Support\Facades\Auth;
use InvalidArgumentException;
use Modules\Purchasing\Suppliers\Application\DTO\SupplierDTO;
use Modules\Purchasing\Suppliers\Domain\Contracts\SupplierRepositoryInterface;

/**
 * Creates a new supplier.
 */
final class CreateSupplierAction extends BaseAction
{
    public function __construct(private readonly SupplierRepositoryInterface $suppliers) {}

    /**
     * @param  mixed  ...$arguments  Expects a single {@see SupplierDTO}.
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        $dto = $arguments[0] ?? null;

        if (! $dto instanceof SupplierDTO) {
            throw new InvalidArgumentException('CreateSupplierAction::execute expects a SupplierDTO.');
        }

        $attributes = $dto->toArray();
        $attributes['company_id'] ??= Auth::user()?->company_id;

        $supplier = $this->suppliers->create($attributes);

        return OperationResult::success($supplier, 'Supplier created successfully.');
    }
}
