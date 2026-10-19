<?php

declare(strict_types=1);

namespace Modules\Organization\Companies\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Organization\Companies\Domain\Contracts\CompanyRepositoryInterface;

/**
 * Returns a paginated, filtered, sorted list of companies.
 */
final class ListCompaniesAction extends BaseAction
{
    public function __construct(private readonly CompanyRepositoryInterface $companies) {}

    /**
     * @param  mixed  ...$arguments  Expects an array<string, mixed> of filters.
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        /** @var array<string, mixed> $filters */
        $filters = is_array($arguments[0] ?? null) ? $arguments[0] : [];

        return OperationResult::success($this->companies->paginate($filters));
    }
}
