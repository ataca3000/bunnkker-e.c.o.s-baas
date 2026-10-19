<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseMaterials\Application\Actions;

use App\Core\Responses\OperationResult;
use Modules\Purchasing\PurchaseMaterials\Domain\Contracts\PurchaseMaterialRepositoryInterface;
use Modules\Purchasing\PurchaseMaterials\Domain\Exceptions\PurchaseMaterialNotFoundException;

final class GetPurchaseMaterialAction
{
    public function __construct(
        private readonly PurchaseMaterialRepositoryInterface $repository,
    ) {}

    public function execute(string $id): OperationResult
    {
        $material = $this->repository->findById($id);

        if ($material === null) {
            throw new PurchaseMaterialNotFoundException($id);
        }

        return OperationResult::success($material, '');
    }
}
