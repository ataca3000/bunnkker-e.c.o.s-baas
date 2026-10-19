<?php

declare(strict_types=1);

namespace Modules\Commerce\ProductMappings\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Commerce\ProductMappings\Domain\Contracts\ProductMappingRepositoryInterface;

final class ListProductMappingsAction extends BaseAction
{
    public function __construct(private readonly ProductMappingRepositoryInterface $mappings) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $filters = is_array($arguments[0] ?? null) ? $arguments[0] : [];

        return OperationResult::success($this->mappings->paginate($filters));
    }
}
