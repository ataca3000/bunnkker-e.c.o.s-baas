<?php

declare(strict_types=1);

namespace Modules\Commerce\ProductMappings\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Commerce\ProductMappings\Domain\Contracts\ProductMappingRepositoryInterface;
use Modules\Commerce\ProductMappings\Domain\Exceptions\ProductMappingNotFoundException;

final class DeleteProductMappingAction extends BaseAction
{
    public function __construct(private readonly ProductMappingRepositoryInterface $mappings) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');
        $mapping = $this->mappings->findById($id);

        if ($mapping === null) {
            throw new ProductMappingNotFoundException($id);
        }

        $this->mappings->delete($mapping);

        return OperationResult::success(null, 'Product mapping deleted successfully.');
    }
}
