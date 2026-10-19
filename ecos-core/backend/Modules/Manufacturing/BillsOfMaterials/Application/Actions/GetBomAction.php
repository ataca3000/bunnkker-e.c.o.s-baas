<?php

declare(strict_types=1);

namespace Modules\Manufacturing\BillsOfMaterials\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use InvalidArgumentException;
use Modules\Manufacturing\BillsOfMaterials\Domain\Contracts\BomRepositoryInterface;
use Modules\Manufacturing\BillsOfMaterials\Domain\Exceptions\BomNotFoundException;

final class GetBomAction extends BaseAction
{
    public function __construct(private readonly BomRepositoryInterface $boms) {}

    /**
     * @param  mixed  ...$arguments  Expects a BOM id string.
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        $id = $arguments[0] ?? null;

        if (! is_string($id) || $id === '') {
            throw new InvalidArgumentException('GetBomAction::execute expects a BOM id string.');
        }

        $bom = $this->boms->findById($id);

        if ($bom === null) {
            throw new BomNotFoundException($id);
        }

        return OperationResult::success($bom);
    }
}
