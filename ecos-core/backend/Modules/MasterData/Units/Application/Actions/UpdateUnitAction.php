<?php

declare(strict_types=1);

namespace Modules\MasterData\Units\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use InvalidArgumentException;
use Modules\MasterData\Units\Application\DTO\UnitDTO;
use Modules\MasterData\Units\Domain\Contracts\UnitRepositoryInterface;
use Modules\MasterData\Units\Domain\Exceptions\UnitNotFoundException;

/**
 * Updates an existing unit of measure.
 */
final class UpdateUnitAction extends BaseAction
{
    public function __construct(private readonly UnitRepositoryInterface $units) {}

    /**
     * @param  mixed  ...$arguments  Expects (string $id, UnitDTO $dto).
     *
     * @throws UnitNotFoundException
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');
        $dto = $arguments[1] ?? null;

        if (! $dto instanceof UnitDTO) {
            throw new InvalidArgumentException('UpdateUnitAction::execute expects a UnitDTO.');
        }

        $unit = $this->units->findById($id);

        if ($unit === null) {
            throw new UnitNotFoundException;
        }

        $unit = $this->units->update($unit, $dto->toArray());

        return OperationResult::success($unit, 'Unit updated successfully.');
    }
}
