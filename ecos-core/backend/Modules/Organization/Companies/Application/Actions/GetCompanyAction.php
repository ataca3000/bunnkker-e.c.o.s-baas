<?php

declare(strict_types=1);

namespace Modules\Organization\Companies\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Organization\Companies\Domain\Contracts\CompanyRepositoryInterface;
use Modules\Organization\Companies\Domain\Exceptions\CompanyNotFoundException;

/**
 * Fetches a single company by id.
 */
final class GetCompanyAction extends BaseAction
{
    public function __construct(private readonly CompanyRepositoryInterface $companies) {}

    /**
     * @param  mixed  ...$arguments  Expects the company id (string).
     *
     * @throws CompanyNotFoundException
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');

        $company = $this->companies->findById($id);

        if ($company === null) {
            throw new CompanyNotFoundException;
        }

        return OperationResult::success($company);
    }
}
