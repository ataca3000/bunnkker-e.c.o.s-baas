<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Infrastructure\Repositories;

use Modules\ClaudeBridge\Domain\Contracts\WorkerRepositoryInterface;
use Modules\ClaudeBridge\Domain\Models\Worker;

final class EloquentWorkerRepository implements WorkerRepositoryInterface
{
    public function findById(string $id, string $companyId): ?Worker
    {
        return Worker::where('id', $id)->where('company_id', $companyId)->first();
    }

    public function findByToken(string $plainToken): ?Worker
    {
        // Bcrypt cannot be searched with a WHERE clause — load active workers and verify hash
        $workers = Worker::where('is_active', true)->get();

        foreach ($workers as $worker) {
            if (password_verify($plainToken, $worker->token_hash)) {
                return $worker;
            }
        }

        return null;
    }

    public function allActive(string $companyId): mixed
    {
        return Worker::where('company_id', $companyId)->where('is_active', true)->get();
    }

    public function create(array $attributes): Worker
    {
        return Worker::create($attributes);
    }

    public function update(Worker $worker, array $attributes): Worker
    {
        $worker->update($attributes);

        return $worker->fresh();
    }

    public function deactivate(Worker $worker): void
    {
        $worker->update(['is_active' => false]);
    }
}
