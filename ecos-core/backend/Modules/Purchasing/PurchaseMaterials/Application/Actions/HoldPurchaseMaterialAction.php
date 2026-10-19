<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseMaterials\Application\Actions;

use App\Core\Responses\OperationResult;
use Illuminate\Http\Request;
use Modules\Purchasing\PurchaseMaterials\Domain\Contracts\PurchaseMaterialRepositoryInterface;
use Modules\Purchasing\PurchaseMaterials\Domain\Enums\PurchaseMaterialStatus;
use Modules\Purchasing\PurchaseMaterials\Domain\Exceptions\InvalidPurchaseMaterialStatusException;
use Modules\Purchasing\PurchaseMaterials\Domain\Exceptions\PurchaseMaterialNotFoundException;

final class HoldPurchaseMaterialAction
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

        if (! $material->status->canHold()) {
            throw new InvalidPurchaseMaterialStatusException(
                $material->request_number,
                $material->status->value,
                [
                    PurchaseMaterialStatus::Draft->value,
                    PurchaseMaterialStatus::UnderReview->value,
                    PurchaseMaterialStatus::WaitingSupplierSelection->value,
                    PurchaseMaterialStatus::Approved->value,
                ],
            );
        }

        $material->update([
            'status' => PurchaseMaterialStatus::OnHold->value,
            'updated_by' => (string) $request->user()?->id,
        ]);

        return OperationResult::success($material->refresh(), 'Purchase material placed on hold.');
    }
}
