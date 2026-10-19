<?php

declare(strict_types=1);

namespace Modules\Organization\Companies\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use InvalidArgumentException;
use Modules\Organization\Companies\Application\DTO\CompanyDTO;
use Modules\Organization\Companies\Domain\Contracts\CompanyRepositoryInterface;
use Modules\Organization\Companies\Domain\Exceptions\CompanyNotFoundException;

/**
 * Updates an existing company.
 */
final class UpdateCompanyAction extends BaseAction
{
    public function __construct(private readonly CompanyRepositoryInterface $companies) {}

    /**
     * @param  mixed  ...$arguments  Expects (string $id, CompanyDTO $dto).
     *
     * @throws CompanyNotFoundException
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');
        $dto = $arguments[1] ?? null;

        if (! $dto instanceof CompanyDTO) {
            throw new InvalidArgumentException('UpdateCompanyAction::execute expects a CompanyDTO.');
        }

        $company = $this->companies->findById($id);

        if ($company === null) {
            throw new CompanyNotFoundException;
        }

        $company = $this->companies->update($company, $dto->toArray());

        return OperationResult::success($company, 'Company updated successfully.');
    }
}
