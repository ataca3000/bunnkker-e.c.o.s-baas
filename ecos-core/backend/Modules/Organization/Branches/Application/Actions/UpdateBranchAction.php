<?php

declare(strict_types=1);

namespace Modules\Organization\Branches\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use InvalidArgumentException;
use Modules\Organization\Branches\Application\DTO\BranchDTO;
use Modules\Organization\Branches\Domain\Contracts\BranchRepositoryInterface;
use Modules\Organization\Branches\Domain\Exceptions\BranchNotFoundException;
use Modules\Organization\Branches\Domain\Exceptions\DuplicateHeadOfficeException;

/**
 * Updates an existing branch, enforcing the single-head-office-per-company rule.
 */
final class UpdateBranchAction extends BaseAction
{
    public function __construct(private readonly BranchRepositoryInterface $branches) {}

    /**
     * @param  mixed  ...$arguments  Expects (string $id, BranchDTO $dto).
     *
     * @throws BranchNotFoundException
     * @throws DuplicateHeadOfficeException
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');
        $dto = $arguments[1] ?? null;

        if (! $dto instanceof BranchDTO) {
            throw new InvalidArgumentException('UpdateBranchAction::execute expects a BranchDTO.');
        }

        $branch = $this->branches->findById($id);

        if ($branch === null) {
            throw new BranchNotFoundException;
        }

        if ($dto->is_head_office && $this->branches->headOfficeExists($dto->company_id, $branch->id)) {
            throw new DuplicateHeadOfficeException;
        }

        $branch = $this->branches->update($branch, $dto->toArray());

        return OperationResult::success($branch, 'Branch updated successfully.');
    }
}
