<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Infrastructure\Repositories;

use Modules\ClaudeBridge\Domain\Contracts\TaskRepositoryInterface;
use Modules\ClaudeBridge\Domain\Enums\TaskStatus;
use Modules\ClaudeBridge\Domain\Models\Task;

final class EloquentTaskRepository implements TaskRepositoryInterface
{
    public function findById(string $id, string $companyId): ?Task
    {
        return Task::where('id', $id)->where('company_id', $companyId)->first();
    }

    public function paginate(string $companyId, array $filters = [], int $perPage = 20): mixed
    {
        $query = Task::where('company_id', $companyId)->latest();

        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (isset($filters['priority'])) {
            $query->where('priority', $filters['priority']);
        }

        return $query->paginate($perPage);
    }

    public function create(array $attributes): Task
    {
        return Task::create($attributes);
    }

    public function update(Task $task, array $attributes): Task
    {
        $task->update($attributes);

        return $task->fresh();
    }

    public function nextQueued(string $companyId): ?Task
    {
        return Task::where('company_id', $companyId)
            ->where('status', TaskStatus::Queued)
            ->orderByRaw("CASE priority WHEN 'high' THEN 1 WHEN 'normal' THEN 2 WHEN 'low' THEN 3 END")
            ->oldest()
            ->first();
    }

    public function findRunningByWorker(string $workerId): ?Task
    {
        return Task::where('worker_id', $workerId)
            ->where('status', TaskStatus::Running)
            ->first();
    }
}
