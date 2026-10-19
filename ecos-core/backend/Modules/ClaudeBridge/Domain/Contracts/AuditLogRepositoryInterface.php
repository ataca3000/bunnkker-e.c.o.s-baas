<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Domain\Contracts;

use Modules\ClaudeBridge\Domain\Enums\ActorType;
use Modules\ClaudeBridge\Domain\Models\AuditLog;

interface AuditLogRepositoryInterface
{
    public function record(
        string $companyId,
        ActorType $actorType,
        string $actorId,
        string $actorName,
        string $action,
        string $description,
        ?string $taskId = null,
    ): AuditLog;

    /** @return \Illuminate\Pagination\LengthAwarePaginator<AuditLog> */
    public function paginateForTask(string $taskId, int $perPage = 50): mixed;
}
