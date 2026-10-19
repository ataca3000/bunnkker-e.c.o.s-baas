<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseMaterials\Application\Actions;

use App\Core\Responses\OperationResult;
use Illuminate\Http\Request;
use Modules\Purchasing\PurchaseMaterials\Domain\Contracts\PurchaseMaterialRepositoryInterface;
use Modules\Purchasing\PurchaseMaterials\Domain\Enums\PurchaseMaterialStatus;
use Modules\Purchasing\PurchaseMaterials\Domain\Exceptions\InvalidPurchaseMaterialStatusException;
use Modules\Purchasing\PurchaseMaterials\Domain\Exceptions\PurchaseMaterialNotFoundException;

final class RejectPurchaseMaterialAction
{
    public function __construct(
        private readonly PurchaseMaterialRepositoryInterface $repository,
    ) {}

    public function execute(string $id, ?string $reason, Request $request): OperationResult
    {
        $material = $this->repository->findById($id);

        if ($material === null) {
            throw new PurchaseMaterialNotFoundException($id);
        }

        if (! $material->status->canReject()) {
            throw new InvalidPurchaseMaterialStatusException(
                $material->request_number,
                $material->status->value,
                [PurchaseMaterialStatus::UnderReview->value, PurchaseMaterialStatus::WaitingSupplierSelection->value],
            );
        }

        $material->update([
            'status' => PurchaseMaterialStatus::Rejected->value,
            'rejected_by' => (string) $request->user()?->id,
            'rejection_reason' => $reason,
            'updated_by' => (string) $request->user()?->id,
        ]);

        return OperationResult::success($material->refresh(), 'Purchase material rejected.');
    }
}
