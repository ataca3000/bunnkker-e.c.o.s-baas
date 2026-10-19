<?php

declare(strict_types=1);

namespace Modules\MasterData\Categories\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\MasterData\Categories\Domain\Contracts\CategoryRepositoryInterface;

/**
 * Returns a paginated, filtered, sorted list of categories.
 */
final class ListCategoriesAction extends BaseAction
{
    public function __construct(private readonly CategoryRepositoryInterface $categories) {}

    /**
     * @param  mixed  ...$arguments  Expects an array<string, mixed> of filters.
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        /** @var array<string, mixed> $filters */
        $filters = is_array($arguments[0] ?? null) ? $arguments[0] : [];

        return OperationResult::success($this->categories->paginate($filters));
    }
}
