<?php

declare(strict_types=1);

namespace Modules\Organization\Branches\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use InvalidArgumentException;
use Modules\Organization\Branches\Application\DTO\BranchDTO;
use Modules\Organization\Branches\Domain\Contracts\BranchRepositoryInterface;
use Modules\Organization\Branches\Domain\Exceptions\DuplicateHeadOfficeException;

/**
 * Creates a new branch, enforcing the single-head-office-per-company rule.
 */
final class CreateBranchAction extends BaseAction
{
    public function __construct(private readonly BranchRepositoryInterface $branches) {}

    /**
     * @param  mixed  ...$arguments  Expects a single {@see BranchDTO}.
     *
     * @throws DuplicateHeadOfficeException
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        $dto = $arguments[0] ?? null;

        if (! $dto instanceof BranchDTO) {
            throw new InvalidArgumentException('CreateBranchAction::execute expects a BranchDTO.');
        }

        if ($dto->is_head_office && $this->branches->headOfficeExists($dto->company_id)) {
            throw new DuplicateHeadOfficeException;
        }

        $branch = $this->branches->create($dto->toArray());

        return OperationResult::success($branch, 'Branch created successfully.');
    }
}
