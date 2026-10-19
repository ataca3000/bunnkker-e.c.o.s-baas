<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseMaterials\Application\Actions;

use Illuminate\Http\Request;
use Modules\Purchasing\PurchaseMaterials\Domain\Contracts\PurchaseMaterialRepositoryInterface;
use Modules\Purchasing\PurchaseMaterials\Domain\Exceptions\PurchaseMaterialNotFoundException;
use Modules\Shared\Application\OperationResult;

final class AssignBuyerAction
{
    public function __construct(
        private readonly PurchaseMaterialRepositoryInterface $repository,
    ) {}

    public function execute(string $id, string $buyerName, Request $request): OperationResult
    {
        $material = $this->repository->findById($id);
        if ($material === null) {
            throw new PurchaseMaterialNotFoundException($id);
        }

        $material->update(['assigned_buyer' => $buyerName]);

        return OperationResult::success($material->refresh(), 'Buyer assigned successfully.');
    }
}
