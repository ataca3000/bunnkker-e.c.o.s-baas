<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseMaterials\Application\Actions;

use App\Core\Responses\OperationResult;
use Illuminate\Http\Request;
use Modules\Purchasing\PurchaseMaterials\Application\DTO\PurchaseMaterialDTO;
use Modules\Purchasing\PurchaseMaterials\Application\DTO\PurchaseMaterialLineDTO;
use Modules\Purchasing\PurchaseMaterials\Domain\Contracts\PurchaseMaterialRepositoryInterface;
use Modules\Purchasing\PurchaseMaterials\Domain\Exceptions\InvalidPurchaseMaterialStatusException;
use Modules\Purchasing\PurchaseMaterials\Domain\Exceptions\PurchaseMaterialNotFoundException;

final class UpdatePurchaseMaterialAction
{
    public function __construct(
        private readonly PurchaseMaterialRepositoryInterface $repository,
    ) {}

    public function execute(string $id, PurchaseMaterialDTO $dto, Request $request): OperationResult
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

        $attributes = [
            'warehouse_id' => $dto->warehouse_id,
            'company_id' => $dto->company_id,
            'channel_id' => $dto->channel_id,
            'priority' => $dto->priority,
            'required_date' => $dto->required_date,
            'notes' => $dto->notes,
            'updated_by' => (string) $request->user()?->id,
        ];

        $lines = array_map(fn (PurchaseMaterialLineDTO $line): array => [
            'product_id' => $line->product_id,
            'requested_qty' => $line->requested_qty,
            'unit_label' => $line->unit_label,
            'notes' => $line->notes,
        ], $dto->lines);

        $updated = $this->repository->update($material, $attributes, $lines);

        return OperationResult::success($updated, 'Purchase material request updated.');
    }
}
