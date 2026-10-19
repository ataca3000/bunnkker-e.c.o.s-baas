<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseMaterials\Application\Actions;

use App\Core\Responses\OperationResult;
use Illuminate\Http\Request;
use Modules\Purchasing\PurchaseMaterials\Domain\Contracts\PurchaseMaterialRepositoryInterface;
use Modules\Purchasing\PurchaseMaterials\Domain\Enums\PurchaseMaterialStatus;
use Modules\Purchasing\PurchaseMaterials\Domain\Exceptions\InvalidPurchaseMaterialStatusException;
use Modules\Purchasing\PurchaseMaterials\Domain\Exceptions\PurchaseMaterialNotFoundException;

final class CancelPurchaseMaterialAction
{
    public function __construct(
        private readonly PurchaseMaterialRepositoryInterface $repository,
    ) {}

    public function execute(string $id, Request $request): OperationResult
    {
        $material = $this->repository->findById($id);

        if ($material === null) {
            throw new PurchaseMaterialNotFoundException($id);
        }

        if (! $material->status->canCancel()) {
            throw new InvalidPurchaseMaterialStatusException(
                $material->request_number,
                $material->status->value,
                [
                    PurchaseMaterialStatus::Draft->value,
                    PurchaseMaterialStatus::UnderReview->value,
                    PurchaseMaterialStatus::WaitingSupplierSelection->value,
                    PurchaseMaterialStatus::OnHold->value,
                ],
            );
        }

        $material->update([
            'status' => PurchaseMaterialStatus::Cancelled->value,
            'updated_by' => (string) $request->user()?->id,
        ]);

        return OperationResult::success($material->refresh(), 'Purchase material cancelled.');
    }
}
