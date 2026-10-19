<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Domain\Contracts;

use Modules\ClaudeBridge\Domain\Models\Execution;

interface ExecutionRepositoryInterface
{
    public function findById(string $id): ?Execution;

    public function create(array $attributes): Execution;

    public function update(Execution $execution, array $attributes): Execution;

    public function nextAttemptNumber(string $taskId): int;
}
