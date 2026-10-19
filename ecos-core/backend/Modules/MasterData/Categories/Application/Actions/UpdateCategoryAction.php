<?php

declare(strict_types=1);

namespace Modules\MasterData\Categories\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use InvalidArgumentException;
use Modules\MasterData\Categories\Application\DTO\CategoryDTO;
use Modules\MasterData\Categories\Domain\Contracts\CategoryRepositoryInterface;
use Modules\MasterData\Categories\Domain\Exceptions\CategoryDepthExceededException;
use Modules\MasterData\Categories\Domain\Exceptions\CategoryNotFoundException;
use Modules\MasterData\Categories\Domain\Exceptions\InvalidCategoryParentException;

/**
 * Updates a category, recomputing its level and enforcing the 3-level depth and
 * the "not its own parent" rule.
 */
final class UpdateCategoryAction extends BaseAction
{
    private const MAX_DEPTH = 3;

    public function __construct(private readonly CategoryRepositoryInterface $categories) {}

    /**
     * @param  mixed  ...$arguments  Expects (string $id, CategoryDTO $dto).
     *
     * @throws CategoryNotFoundException
     * @throws CategoryDepthExceededException
     * @throws InvalidCategoryParentException
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');
        $dto = $arguments[1] ?? null;

        if (! $dto instanceof CategoryDTO) {
            throw new InvalidArgumentException('UpdateCategoryAction::execute expects a CategoryDTO.');
        }

        $category = $this->categories->findById($id);

        if ($category === null) {
            throw new CategoryNotFoundException;
        }

        $level = 1;

        if ($dto->parent_id !== null) {
            if ($dto->parent_id === $category->id) {
                throw new InvalidCategoryParentException;
            }

            $parent = $this->categories->findById($dto->parent_id);

            if ($parent === null) {
                throw new CategoryNotFoundException;
            }

            $level = (int) $parent->level + 1;
        }

        if ($level > self::MAX_DEPTH) {
            throw new CategoryDepthExceededException;
        }

        $attributes = $dto->toArray();
        $attributes['level'] = $level;

        $category = $this->categories->update($category, $attributes);

        return OperationResult::success($category, 'Category updated successfully.');
    }
}
