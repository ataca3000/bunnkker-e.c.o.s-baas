<?php

declare(strict_types=1);

namespace Modules\MasterData\Units\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\MasterData\Units\Domain\Contracts\UnitRepositoryInterface;
use Modules\MasterData\Units\Domain\Exceptions\UnitNotFoundException;

/**
 * Soft-deletes a unit of measure.
 */
final class DeleteUnitAction extends BaseAction
{
    public function __construct(private readonly UnitRepositoryInterface $units) {}

    /**
     * @param  mixed  ...$arguments  Expects the unit id (string).
     *
     * @throws UnitNotFoundException
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');

        $unit = $this->units->findById($id);

        if ($unit === null) {
            throw new UnitNotFoundException;
        }

        $this->units->delete($unit);

        return OperationResult::success(null, 'Unit deleted successfully.');
    }
}
