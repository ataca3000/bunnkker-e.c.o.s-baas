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

/**
 * Creates a category, computing its level from the parent and enforcing the
 * 3-level maximum depth.
 */
final class CreateCategoryAction extends BaseAction
{
    private const MAX_DEPTH = 3;

    public function __construct(private readonly CategoryRepositoryInterface $categories) {}

    /**
     * @param  mixed  ...$arguments  Expects a single {@see CategoryDTO}.
     *
     * @throws CategoryDepthExceededException
     * @throws CategoryNotFoundException
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        $dto = $arguments[0] ?? null;

        if (! $dto instanceof CategoryDTO) {
            throw new InvalidArgumentException('CreateCategoryAction::execute expects a CategoryDTO.');
        }

        $level = 1;

        if ($dto->parent_id !== null) {
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

        $category = $this->categories->create($attributes);

        return OperationResult::success($category, 'Category created successfully.');
    }
}
