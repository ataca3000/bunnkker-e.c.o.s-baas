<?php

declare(strict_types=1);

namespace Modules\Manufacturing\BillsOfMaterials\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use InvalidArgumentException;
use Modules\Manufacturing\BillsOfMaterials\Domain\Contracts\BomRepositoryInterface;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\BillOfMaterial;

final class DeleteBomAction extends BaseAction
{
    public function __construct(private readonly BomRepositoryInterface $boms) {}

    /**
     * @param  mixed  ...$arguments  Expects a {@see BillOfMaterial}.
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        $bom = $arguments[0] ?? null;

        if (! $bom instanceof BillOfMaterial) {
            throw new InvalidArgumentException('DeleteBomAction::execute expects a BillOfMaterial.');
        }

        if ($bom->is_active) {
            return OperationResult::failure('Cannot delete an active Bill of Materials.');
        }

        $this->boms->delete($bom);

        return OperationResult::success(null, 'Bill of Materials deleted successfully.');
    }
}
