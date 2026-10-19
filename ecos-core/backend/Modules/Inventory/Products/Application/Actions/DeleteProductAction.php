<?php

declare(strict_types=1);

namespace Modules\Inventory\Products\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Inventory\Products\Domain\Contracts\ProductRepositoryInterface;
use Modules\Inventory\Products\Domain\Exceptions\ProductNotFoundException;

/**
 * Soft-deletes a product.
 */
final class DeleteProductAction extends BaseAction
{
    public function __construct(private readonly ProductRepositoryInterface $products) {}

    /**
     * @param  mixed  ...$arguments  Expects the product id (string).
     *
     * @throws ProductNotFoundException
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');

        $product = $this->products->findById($id);

        if ($product === null) {
            throw new ProductNotFoundException;
        }

        $this->products->delete($product);

        return OperationResult::success(null, 'Product deleted successfully.');
    }
}
