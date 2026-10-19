<?php

declare(strict_types=1);

namespace Modules\Commerce\ProductMappings\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Commerce\ProductMappings\Application\DTO\ProductMappingDTO;
use Modules\Commerce\ProductMappings\Domain\Contracts\ProductMappingRepositoryInterface;

final class CreateProductMappingAction extends BaseAction
{
    public function __construct(private readonly ProductMappingRepositoryInterface $mappings) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        /** @var ProductMappingDTO $dto */
        $dto = $arguments[0];

        $mapping = $this->mappings->create($dto->toAttributes());

        return OperationResult::success($mapping, 'Product mapping created successfully.');
    }
}
