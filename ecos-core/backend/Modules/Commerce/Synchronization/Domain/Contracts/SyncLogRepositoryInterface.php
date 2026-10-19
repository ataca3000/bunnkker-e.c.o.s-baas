<?php

declare(strict_types=1);

namespace Modules\Commerce\Synchronization\Domain\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Commerce\Synchronization\Domain\Models\SyncLog;

interface SyncLogRepositoryInterface
{
    /** @param array<string, mixed> $filters */
    public function paginate(array $filters): LengthAwarePaginator;

    public function findById(string $id): ?SyncLog;
}
