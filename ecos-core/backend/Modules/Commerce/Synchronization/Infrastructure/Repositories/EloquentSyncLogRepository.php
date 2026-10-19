<?php

declare(strict_types=1);

namespace Modules\Commerce\Synchronization\Infrastructure\Repositories;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Commerce\Synchronization\Domain\Contracts\SyncLogRepositoryInterface;
use Modules\Commerce\Synchronization\Domain\Models\SyncLog;

final class EloquentSyncLogRepository implements SyncLogRepositoryInterface
{
    private const WITH = ['channel'];

    public function paginate(array $filters): LengthAwarePaginator
    {
        $query = SyncLog::query()->with(self::WITH);

        if (! empty($filters['channel_id'])) {
            $query->where('channel_id', $filters['channel_id']);
        }

        if (! empty($filters['entity_type'])) {
            $query->where('entity_type', $filters['entity_type']);
        }

        if (! empty($filters['direction'])) {
            $query->where('direction', $filters['direction']);
        }

        if (! empty($filters['status']) && $filters['status'] !== 'all') {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['date_from'])) {
            $query->whereDate('synced_at', '>=', $filters['date_from']);
        }

        if (! empty($filters['date_to'])) {
            $query->whereDate('synced_at', '<=', $filters['date_to']);
        }

        $sortBy = in_array($filters['sort_by'] ?? '', ['synced_at', 'entity_type', 'direction', 'status', 'created_at'], true)
            ? $filters['sort_by']
            : 'synced_at';

        $sortDir = ($filters['sort_dir'] ?? 'desc') === 'asc' ? 'asc' : 'desc';

        $query->orderBy($sortBy, $sortDir);

        $perPage = min(100, max(1, (int) ($filters['per_page'] ?? 15)));

        return $query->paginate($perPage);
    }

    public function findById(string $id): ?SyncLog
    {
        return SyncLog::query()->with(self::WITH)->find($id);
    }
}
