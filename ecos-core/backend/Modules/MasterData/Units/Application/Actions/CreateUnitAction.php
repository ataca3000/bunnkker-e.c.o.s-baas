<?php

declare(strict_types=1);

namespace Modules\MasterData\Units\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use InvalidArgumentException;
use Modules\MasterData\Units\Application\DTO\UnitDTO;
use Modules\MasterData\Units\Domain\Contracts\UnitRepositoryInterface;

/**
 * Creates a new unit of measure.
 */
final class CreateUnitAction extends BaseAction
{
    public function __construct(private readonly UnitRepositoryInterface $units) {}

    /**
     * @param  mixed  ...$arguments  Expects a single {@see UnitDTO}.
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        $dto = $arguments[0] ?? null;

        if (! $dto instanceof UnitDTO) {
            throw new InvalidArgumentException('CreateUnitAction::execute expects a UnitDTO.');
        }

        $unit = $this->units->create($dto->toArray());

        return OperationResult::success($unit, 'Unit created successfully.');
    }
}
