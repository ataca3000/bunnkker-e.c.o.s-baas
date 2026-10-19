<?php

declare(strict_types=1);

namespace Modules\Organization\Teams\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use InvalidArgumentException;
use Modules\Organization\Teams\Domain\Contracts\TeamRepositoryInterface;
use Modules\Organization\Teams\Domain\Exceptions\TeamNotFoundException;

final class GetTeamAction extends BaseAction
{
    public function __construct(private readonly TeamRepositoryInterface $teams) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $id = $arguments[0] ?? null;

        if (! is_string($id)) {
            throw new InvalidArgumentException('GetTeamAction::execute expects a string id.');
        }

        $team = $this->teams->findById($id);
        if ($team === null) {
            throw new TeamNotFoundException($id);
        }

        return OperationResult::success($team);
    }
}
