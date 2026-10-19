<?php

declare(strict_types=1);

namespace Modules\Commerce\Synchronization\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Commerce\Synchronization\Application\Actions\ListSyncLogsAction;
use Modules\Commerce\Synchronization\Application\Actions\RetrySyncLogAction;
use Modules\Commerce\Synchronization\Domain\Models\SyncLog;
use Modules\Commerce\Synchronization\Presentation\Http\Resources\SyncLogResource;

final class SynchronizationController extends Controller
{
    use HasApiResponse;

    public function index(Request $request, ListSyncLogsAction $action): JsonResponse
    {
        $filters = [
            'channel_id' => $request->query('channel_id'),
            'entity_type' => $request->query('entity_type'),
            'direction' => $request->query('direction'),
            'status' => $request->query('status', 'all'),
            'date_from' => $request->query('date_from'),
            'date_to' => $request->query('date_to'),
            'sort_by' => $request->query('sort_by', 'synced_at'),
            'sort_dir' => $request->query('sort_dir', 'desc'),
            'per_page' => $request->query('per_page', 15),
        ];

        $paginator = $action->execute($filters)->data();

        return $this->success([
            'items' => SyncLogResource::collection($paginator->items()),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function retry(SyncLog $syncLog, RetrySyncLogAction $action): JsonResponse
    {
        $result = $action->execute($syncLog);

        if ($result->isFailure()) {
            return $this->error($result->message() ?? 'Retry failed.', 422);
        }

        return $this->success(null, $result->message() ?? 'Retry dispatched.');
    }
}
