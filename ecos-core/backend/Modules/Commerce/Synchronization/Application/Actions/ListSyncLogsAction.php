<?php

declare(strict_types=1);

namespace Modules\Commerce\Synchronization\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Commerce\Synchronization\Domain\Contracts\SyncLogRepositoryInterface;

final class ListSyncLogsAction extends BaseAction
{
    public function __construct(private readonly SyncLogRepositoryInterface $logs) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $filters = is_array($arguments[0] ?? null) ? $arguments[0] : [];

        return OperationResult::success($this->logs->paginate($filters));
    }
}
