<?php

declare(strict_types=1);

namespace Modules\Manufacturing\BillsOfMaterials\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use InvalidArgumentException;
use Modules\Manufacturing\BillsOfMaterials\Application\DTO\BomDTO;
use Modules\Manufacturing\BillsOfMaterials\Domain\Contracts\BomRepositoryInterface;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\BillOfMaterial;

final class UpdateBomAction extends BaseAction
{
    public function __construct(private readonly BomRepositoryInterface $boms) {}

    /**
     * @param  mixed  ...$arguments  Expects {@see BillOfMaterial}, {@see BomDTO}.
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        $bom = $arguments[0] ?? null;
        $dto = $arguments[1] ?? null;

        if (! $bom instanceof BillOfMaterial || ! $dto instanceof BomDTO) {
            throw new InvalidArgumentException('UpdateBomAction::execute expects a BillOfMaterial and a BomDTO.');
        }

        $attributes = [
            'product_id' => $dto->product_id,
            'version' => $dto->version,
            'is_active' => $dto->is_active,
            'notes' => $dto->notes,
            'manufacturing_cost' => $dto->manufacturing_cost,
            'other_costs' => $dto->other_costs,
            'yield_quantity' => $dto->yield_quantity,
            'execution_instructions' => $dto->execution_instructions,
        ];

        // NULL propagates: the caller omitted `lines`, so the recipe's existing
        // components are left untouched. Only an explicit list (including an
        // explicit empty one) reaches the repository as a replacement.
        $lines = $dto->lines === null ? null : array_map(
            fn (mixed $line): array => [
                'raw_material_id' => $line->raw_material_id,
                'quantity' => $line->quantity,
                'waste_percentage' => $line->waste_percentage,
            ],
            $dto->lines,
        );

        $bom = $this->boms->update($bom, $attributes, $lines);

        return OperationResult::success($bom, 'Bill of Materials updated successfully.');
    }
}
