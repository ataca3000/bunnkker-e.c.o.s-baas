<?php

declare(strict_types=1);

namespace Modules\Organization\Teams\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Organization\Teams\Domain\Contracts\TeamRepositoryInterface;

final class ListTeamsAction extends BaseAction
{
    public function __construct(private readonly TeamRepositoryInterface $teams) {}

    /** @param array<string, mixed> ...$arguments */
    public function execute(mixed ...$arguments): OperationResult
    {
        $filters = $arguments[0] ?? [];

        return OperationResult::success($this->teams->paginate($filters));
    }
}
