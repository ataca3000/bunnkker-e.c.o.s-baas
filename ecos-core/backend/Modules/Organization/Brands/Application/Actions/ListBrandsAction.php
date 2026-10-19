<?php

declare(strict_types=1);

namespace Modules\Organization\Brands\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Organization\Brands\Domain\Contracts\BrandRepositoryInterface;

final class ListBrandsAction extends BaseAction
{
    public function __construct(private readonly BrandRepositoryInterface $brands) {}

    /** @param array<string, mixed> ...$arguments */
    public function execute(mixed ...$arguments): OperationResult
    {
        $filters = $arguments[0] ?? [];

        return OperationResult::success($this->brands->paginate($filters));
    }
}
