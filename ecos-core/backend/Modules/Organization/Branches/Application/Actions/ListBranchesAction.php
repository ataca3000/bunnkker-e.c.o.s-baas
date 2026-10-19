<?php

declare(strict_types=1);

namespace Modules\Organization\Branches\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Organization\Branches\Domain\Contracts\BranchRepositoryInterface;

/**
 * Returns a paginated, filtered, sorted list of branches.
 */
final class ListBranchesAction extends BaseAction
{
    public function __construct(private readonly BranchRepositoryInterface $branches) {}

    /**
     * @param  mixed  ...$arguments  Expects an array<string, mixed> of filters.
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        /** @var array<string, mixed> $filters */
        $filters = is_array($arguments[0] ?? null) ? $arguments[0] : [];

        return OperationResult::success($this->branches->paginate($filters));
    }
}
