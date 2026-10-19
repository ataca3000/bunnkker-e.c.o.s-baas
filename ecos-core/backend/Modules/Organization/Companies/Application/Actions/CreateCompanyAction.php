<?php

declare(strict_types=1);

namespace Modules\Organization\Companies\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use InvalidArgumentException;
use Modules\Organization\Companies\Application\DTO\CompanyDTO;
use Modules\Organization\Companies\Domain\Contracts\CompanyRepositoryInterface;

/**
 * Creates a new company.
 */
final class CreateCompanyAction extends BaseAction
{
    public function __construct(private readonly CompanyRepositoryInterface $companies) {}

    /**
     * @param  mixed  ...$arguments  Expects a single {@see CompanyDTO}.
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        $dto = $arguments[0] ?? null;

        if (! $dto instanceof CompanyDTO) {
            throw new InvalidArgumentException('CreateCompanyAction::execute expects a CompanyDTO.');
        }

        $company = $this->companies->create($dto->toArray());

        return OperationResult::success($company, 'Company created successfully.');
    }
}
