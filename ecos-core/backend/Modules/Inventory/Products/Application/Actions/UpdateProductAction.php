<?php

declare(strict_types=1);

namespace Modules\Inventory\Products\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use InvalidArgumentException;
use Modules\Inventory\Products\Application\DTO\ProductDTO;
use Modules\Inventory\Products\Domain\Contracts\ProductRepositoryInterface;
use Modules\Inventory\Products\Domain\Exceptions\ProductNotFoundException;

/**
 * Updates an existing product.
 */
final class UpdateProductAction extends BaseAction
{
    public function __construct(private readonly ProductRepositoryInterface $products) {}

    /**
     * @param  mixed  ...$arguments  Expects (string $id, ProductDTO $dto).
     *
     * @throws ProductNotFoundException
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');
        $dto = $arguments[1] ?? null;

        if (! $dto instanceof ProductDTO) {
            throw new InvalidArgumentException('UpdateProductAction::execute expects a ProductDTO.');
        }

        $product = $this->products->findById($id);

        if ($product === null) {
            throw new ProductNotFoundException;
        }

        $product = $this->products->update($product, $dto->toArray());

        return OperationResult::success($product, 'Product updated successfully.');
    }
}
