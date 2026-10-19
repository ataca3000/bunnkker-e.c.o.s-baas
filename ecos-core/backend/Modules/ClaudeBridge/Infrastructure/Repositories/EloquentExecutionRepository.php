<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Infrastructure\Repositories;

use Modules\ClaudeBridge\Domain\Contracts\ExecutionRepositoryInterface;
use Modules\ClaudeBridge\Domain\Models\Execution;

final class EloquentExecutionRepository implements ExecutionRepositoryInterface
{
    public function findById(string $id): ?Execution
    {
        return Execution::find($id);
    }

    public function create(array $attributes): Execution
    {
        return Execution::create($attributes);
    }

    public function update(Execution $execution, array $attributes): Execution
    {
        $execution->update($attributes);

        return $execution->fresh();
    }

    public function nextAttemptNumber(string $taskId): int
    {
        return Execution::where('task_id', $taskId)->max('attempt_number') + 1;
    }
}
