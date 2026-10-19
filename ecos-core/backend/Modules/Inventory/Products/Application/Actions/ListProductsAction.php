<?php

declare(strict_types=1);

namespace Modules\Inventory\Products\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Inventory\Products\Domain\Contracts\ProductRepositoryInterface;

/**
 * Returns a paginated, filtered, sorted list of products.
 */
final class ListProductsAction extends BaseAction
{
    public function __construct(private readonly ProductRepositoryInterface $products) {}

    /**
     * @param  mixed  ...$arguments  Expects an array<string, mixed> of filters.
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        /** @var array<string, mixed> $filters */
        $filters = is_array($arguments[0] ?? null) ? $arguments[0] : [];

        return OperationResult::success($this->products->paginate($filters));
    }
}
