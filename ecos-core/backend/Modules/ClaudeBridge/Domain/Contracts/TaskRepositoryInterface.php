<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Domain\Contracts;

use Modules\ClaudeBridge\Domain\Models\Task;

interface TaskRepositoryInterface
{
    public function findById(string $id, string $companyId): ?Task;

    /** @return \Illuminate\Pagination\LengthAwarePaginator<Task> */
    public function paginate(string $companyId, array $filters = [], int $perPage = 20): mixed;

    public function create(array $attributes): Task;

    public function update(Task $task, array $attributes): Task;

    public function nextQueued(string $companyId): ?Task;

    public function findRunningByWorker(string $workerId): ?Task;
}
