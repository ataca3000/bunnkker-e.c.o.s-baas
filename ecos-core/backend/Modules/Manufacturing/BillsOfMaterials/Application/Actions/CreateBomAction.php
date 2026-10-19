<?php

declare(strict_types=1);

namespace Modules\Manufacturing\BillsOfMaterials\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use InvalidArgumentException;
use Modules\Manufacturing\BillsOfMaterials\Application\DTO\BomDTO;
use Modules\Manufacturing\BillsOfMaterials\Domain\Contracts\BomRepositoryInterface;

final class CreateBomAction extends BaseAction
{
    public function __construct(private readonly BomRepositoryInterface $boms) {}

    /**
     * @param  mixed  ...$arguments  Expects a single {@see BomDTO}.
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        $dto = $arguments[0] ?? null;

        if (! $dto instanceof BomDTO) {
            throw new InvalidArgumentException('CreateBomAction::execute expects a BomDTO.');
        }

        $attributes = [
            'bom_number' => $this->boms->nextBomNumber(),
            'product_id' => $dto->product_id,
            'version' => $dto->version,
            'bom_version_number' => $this->boms->nextVersionNumber($dto->product_id),
            'is_active' => $dto->is_active,
            'notes' => $dto->notes,
            'manufacturing_cost' => $dto->manufacturing_cost,
            'other_costs' => $dto->other_costs,
            'yield_quantity' => $dto->yield_quantity,
            'execution_instructions' => $dto->execution_instructions,
        ];

        $lines = array_map(
            fn (mixed $line): array => [
                'raw_material_id' => $line->raw_material_id,
                'quantity' => $line->quantity,
                'waste_percentage' => $line->waste_percentage,
            ],
            // Creation has no existing lines to preserve, so a null here is
            // simply "no components supplied" rather than "leave them alone".
            $dto->lines ?? [],
        );

        $bom = $this->boms->create($attributes, $lines);

        return OperationResult::success($bom, 'Bill of Materials created successfully.');
    }
}
