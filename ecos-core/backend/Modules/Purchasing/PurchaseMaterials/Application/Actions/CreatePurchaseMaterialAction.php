<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseMaterials\Application\Actions;

use App\Core\Responses\OperationResult;
use Illuminate\Http\Request;
use Modules\Purchasing\PurchaseMaterials\Application\DTO\PurchaseMaterialDTO;
use Modules\Purchasing\PurchaseMaterials\Application\DTO\PurchaseMaterialLineDTO;
use Modules\Purchasing\PurchaseMaterials\Domain\Contracts\PurchaseMaterialRepositoryInterface;
use Modules\Purchasing\PurchaseMaterials\Domain\Enums\PurchaseMaterialStatus;

final class CreatePurchaseMaterialAction
{
    public function __construct(
        private readonly PurchaseMaterialRepositoryInterface $repository,
    ) {}

    public function execute(PurchaseMaterialDTO $dto, Request $request): OperationResult
    {
        $attributes = [
            'request_number' => $this->repository->nextRequestNumber(),
            'warehouse_id' => $dto->warehouse_id,
            'company_id' => $dto->company_id,
            'channel_id' => $dto->channel_id,
            'status' => PurchaseMaterialStatus::Draft->value,
            'priority' => $dto->priority,
            'required_date' => $dto->required_date,
            'notes' => $dto->notes,
            'requested_by' => (string) $request->user()?->id,
            'created_by' => (string) $request->user()?->id,
        ];

        $lines = array_map(fn (PurchaseMaterialLineDTO $line): array => [
            'product_id' => $line->product_id,
            'requested_qty' => $line->requested_qty,
            'unit_label' => $line->unit_label,
            'notes' => $line->notes,
        ], $dto->lines);

        $material = $this->repository->create($attributes, $lines);

        return OperationResult::success($material, 'Purchase material request created.');
    }
}
