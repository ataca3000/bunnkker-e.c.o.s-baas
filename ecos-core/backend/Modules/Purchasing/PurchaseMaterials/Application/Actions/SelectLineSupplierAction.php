<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseMaterials\Application\Actions;

use Illuminate\Http\Request;
use Modules\Purchasing\PurchaseMaterials\Domain\Contracts\PurchaseMaterialRepositoryInterface;
use Modules\Purchasing\PurchaseMaterials\Domain\Exceptions\InvalidPurchaseMaterialStatusException;
use Modules\Purchasing\PurchaseMaterials\Domain\Exceptions\PurchaseMaterialNotFoundException;
use Modules\Purchasing\PurchaseMaterials\Domain\Models\PurchaseMaterialLine;
use Modules\Shared\Application\OperationResult;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class SelectLineSupplierAction
{
    public function __construct(
        private readonly PurchaseMaterialRepositoryInterface $repository,
    ) {}

    public function execute(
        string $materialId,
        string $lineId,
        string $supplierId,
        ?float $agreedPrice,
        ?float $agreedQty,
        ?int $leadTimeDays,
        Request $request,
    ): OperationResult {
        $material = $this->repository->findById($materialId);
        if ($material === null) {
            throw new PurchaseMaterialNotFoundException($materialId);
        }

        if (! in_array($material->status->value, ['waiting_supplier_selection', 'approved'], true)) {
            throw new InvalidPurchaseMaterialStatusException(
                "Cannot select supplier when status is '{$material->status->value}'.",
            );
        }

        $line = PurchaseMaterialLine::where('id', $lineId)
            ->where('purchase_material_id', $materialId)
            ->first();

        if ($line === null) {
            throw new NotFoundHttpException("Line {$lineId} not found on request {$materialId}.");
        }

        $line->update([
            'supplier_id' => $supplierId,
            'agreed_price' => $agreedPrice,
            'agreed_qty' => $agreedQty,
            'lead_time_days' => $leadTimeDays,
            'supplier_selected_at' => now(),
            'supplier_selected_by' => $request->user()?->id,
        ]);

        return OperationResult::success($line->refresh(), 'Supplier selected for line.');
    }
}
