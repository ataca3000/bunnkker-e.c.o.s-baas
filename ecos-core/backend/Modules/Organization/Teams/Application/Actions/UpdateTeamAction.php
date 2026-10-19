<?php

declare(strict_types=1);

namespace Modules\Organization\Teams\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use InvalidArgumentException;
use Modules\Organization\Teams\Application\DTO\TeamDTO;
use Modules\Organization\Teams\Domain\Contracts\TeamRepositoryInterface;
use Modules\Organization\Teams\Domain\Exceptions\TeamNotFoundException;

final class UpdateTeamAction extends BaseAction
{
    public function __construct(private readonly TeamRepositoryInterface $teams) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $id = $arguments[0] ?? null;
        $dto = $arguments[1] ?? null;

        if (! is_string($id) || ! $dto instanceof TeamDTO) {
            throw new InvalidArgumentException('UpdateTeamAction::execute expects (string $id, TeamDTO $dto).');
        }

        $team = $this->teams->findById($id);
        if ($team === null) {
            throw new TeamNotFoundException($id);
        }

        $team = $this->teams->update($team, [
            'name' => $dto->name,
            'leader_name' => $dto->leader_name,
            'description' => $dto->description,
            'is_active' => $dto->is_active,
        ]);

        return OperationResult::success($team, 'Team updated successfully.');
    }
}
