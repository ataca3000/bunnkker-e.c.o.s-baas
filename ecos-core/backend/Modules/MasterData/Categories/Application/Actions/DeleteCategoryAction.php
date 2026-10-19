<?php

declare(strict_types=1);

namespace Modules\MasterData\Categories\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\MasterData\Categories\Domain\Contracts\CategoryRepositoryInterface;
use Modules\MasterData\Categories\Domain\Exceptions\CategoryNotFoundException;

/**
 * Soft-deletes a category.
 */
final class DeleteCategoryAction extends BaseAction
{
    public function __construct(private readonly CategoryRepositoryInterface $categories) {}

    /**
     * @param  mixed  ...$arguments  Expects the category id (string).
     *
     * @throws CategoryNotFoundException
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');

        $category = $this->categories->findById($id);

        if ($category === null) {
            throw new CategoryNotFoundException;
        }

        $this->categories->delete($category);

        return OperationResult::success(null, 'Category deleted successfully.');
    }
}
