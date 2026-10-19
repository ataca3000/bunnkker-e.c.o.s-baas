<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Infrastructure\Repositories;

use Modules\ClaudeBridge\Domain\Contracts\AuditLogRepositoryInterface;
use Modules\ClaudeBridge\Domain\Enums\ActorType;
use Modules\ClaudeBridge\Domain\Models\AuditLog;

final class EloquentAuditLogRepository implements AuditLogRepositoryInterface
{
    public function record(
        string $companyId,
        ActorType $actorType,
        string $actorId,
        string $actorName,
        string $action,
        string $description,
        ?string $taskId = null,
    ): AuditLog {
        return AuditLog::create([
            'company_id' => $companyId,
            'actor_type' => $actorType,
            'actor_id' => $actorId,
            'actor_name' => $actorName,
            'action' => $action,
            'task_id' => $taskId,
            'description' => $description,
            'occurred_at' => now(),
        ]);
    }

    public function paginateForTask(string $taskId, int $perPage = 50): mixed
    {
        return AuditLog::where('task_id', $taskId)
            ->orderBy('occurred_at', 'desc')
            ->paginate($perPage);
    }
}
