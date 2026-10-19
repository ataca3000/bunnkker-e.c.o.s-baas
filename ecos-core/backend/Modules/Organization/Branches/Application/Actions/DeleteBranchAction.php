<?php

declare(strict_types=1);

namespace Modules\Organization\Branches\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Organization\Branches\Domain\Contracts\BranchRepositoryInterface;
use Modules\Organization\Branches\Domain\Exceptions\BranchNotFoundException;

/**
 * Soft-deletes a branch.
 */
final class DeleteBranchAction extends BaseAction
{
    public function __construct(private readonly BranchRepositoryInterface $branches) {}

    /**
     * @param  mixed  ...$arguments  Expects the branch id (string).
     *
     * @throws BranchNotFoundException
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');

        $branch = $this->branches->findById($id);

        if ($branch === null) {
            throw new BranchNotFoundException;
        }

        $this->branches->delete($branch);

        return OperationResult::success(null, 'Branch deleted successfully.');
    }
}
