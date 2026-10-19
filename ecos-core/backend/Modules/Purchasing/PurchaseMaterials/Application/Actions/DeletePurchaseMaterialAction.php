<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseMaterials\Application\Actions;

use App\Core\Responses\OperationResult;
use Modules\Purchasing\PurchaseMaterials\Domain\Contracts\PurchaseMaterialRepositoryInterface;
use Modules\Purchasing\PurchaseMaterials\Domain\Exceptions\InvalidPurchaseMaterialStatusException;
use Modules\Purchasing\PurchaseMaterials\Domain\Exceptions\PurchaseMaterialNotFoundException;

final class DeletePurchaseMaterialAction
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

        if (! $material->status->isEditable()) {
            throw new InvalidPurchaseMaterialStatusException(
                $material->request_number,
                $material->status->value,
                ['draft', 'on_hold'],
            );
        }

        $this->repository->delete($material);

        return OperationResult::success(null, 'Purchase material request deleted.');
    }
}
