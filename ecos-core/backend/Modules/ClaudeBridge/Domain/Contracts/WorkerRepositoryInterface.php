<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Domain\Contracts;

use Modules\ClaudeBridge\Domain\Models\Worker;

interface WorkerRepositoryInterface
{
    public function findById(string $id, string $companyId): ?Worker;

    public function findByToken(string $plainToken): ?Worker;

    /** @return \Illuminate\Database\Eloquent\Collection<int, Worker> */
    public function allActive(string $companyId): mixed;

    public function create(array $attributes): Worker;

    public function update(Worker $worker, array $attributes): Worker;

    public function deactivate(Worker $worker): void;
}
