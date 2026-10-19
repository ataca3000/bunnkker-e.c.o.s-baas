<?php

declare(strict_types=1);

namespace Modules\Inventory\Products\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use InvalidArgumentException;
use Modules\Inventory\Products\Application\DTO\ProductDTO;
use Modules\Inventory\Products\Domain\Contracts\ProductRepositoryInterface;

/**
 * Creates a new product.
 */
final class CreateProductAction extends BaseAction
{
    public function __construct(private readonly ProductRepositoryInterface $products) {}

    /**
     * @param  mixed  ...$arguments  Expects a single {@see ProductDTO}.
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        $dto = $arguments[0] ?? null;

        if (! $dto instanceof ProductDTO) {
            throw new InvalidArgumentException('CreateProductAction::execute expects a ProductDTO.');
        }

        $product = $this->products->create($dto->toArray());

        return OperationResult::success($product, 'Product created successfully.');
    }
}
