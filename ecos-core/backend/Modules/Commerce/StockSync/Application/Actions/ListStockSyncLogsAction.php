<?php

declare(strict_types=1);

namespace Modules\Commerce\StockSync\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Commerce\StockSync\Domain\Models\StockSyncLog;

final class ListStockSyncLogsAction extends BaseAction
{
    /**
     * Arguments:
     *   [0] filters (array)
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        /** @var array<string, mixed> $filters */
        $filters = (array) ($arguments[0] ?? []);

        $query = StockSyncLog::query()
            ->with(['channel', 'product'])
            ->orderBy(
                (string) ($filters['sort_by'] ?? 'synced_at'),
                (string) ($filters['sort_dir'] ?? 'desc'),
            );

        if (! empty($filters['channel_id'])) {
            $query->where('channel_id', $filters['channel_id']);
        }

        if (! empty($filters['status']) && $filters['status'] !== 'all') {
            $query->where('sync_status', $filters['status']);
        }

        if (! empty($filters['date_from'])) {
            $query->whereDate('synced_at', '>=', $filters['date_from']);
        }

        if (! empty($filters['date_to'])) {
            $query->whereDate('synced_at', '<=', $filters['date_to']);
        }

        if (! empty($filters['search'])) {
            $search = '%'.$filters['search'].'%';
            $query->where(function ($q) use ($search): void {
                $q->whereHas('product', fn ($p) => $p->where('name', 'like', $search)
                    ->orWhere('sku', 'like', $search))
                    ->orWhereHas('channel', fn ($c) => $c->where('name', 'like', $search));
            });
        }

        /** @var LengthAwarePaginator $paginator */
        $paginator = $query->paginate((int) ($filters['per_page'] ?? 15));

        return OperationResult::success($paginator);
    }
}
