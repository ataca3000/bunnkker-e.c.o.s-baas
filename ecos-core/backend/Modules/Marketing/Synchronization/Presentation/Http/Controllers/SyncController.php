<?php

declare(strict_types=1);

namespace Modules\Marketing\Synchronization\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;
use Modules\Marketing\Synchronization\Application\Actions\RunSyncAction;
use Modules\Marketing\Synchronization\Domain\Enums\SyncType;
use Modules\Marketing\Synchronization\Domain\Models\MarketingSyncLog;
use Modules\Marketing\Synchronization\Infrastructure\Jobs\SyncMarketingAssetsJob;
use Modules\Marketing\Synchronization\Presentation\Http\Resources\SyncLogResource;

final class SyncController extends Controller
{
    public function __construct(private readonly RunSyncAction $runSync) {}

    /**
     * POST /marketing/connections/{connection}/sync
     *
     * Triggers a synchronous full sync. For large accounts, dispatch as job.
     */
    public function triggerSync(Request $request, MarketingConnection $connection): JsonResponse
    {
        $async = $request->boolean('async', false);
        $actorId = (string) (string) $request->user()->id;

        if ($async) {
            SyncMarketingAssetsJob::dispatch($connection, SyncType::Manual, $actorId);

            return response()->json(['message' => 'Sync queued.'], 202);
        }

        $syncLog = $this->runSync->execute($connection, SyncType::Manual, $actorId);

        return response()->json([
            'message' => 'Sync completed.',
            'data' => new SyncLogResource($syncLog),
        ]);
    }

    /**
     * GET /marketing/connections/{connection}/sync-logs
     */
    public function logs(Request $request, MarketingConnection $connection): JsonResponse
    {
        $logs = MarketingSyncLog::where('marketing_connection_id', $connection->id)
            ->orderByDesc('started_at')
            ->paginate((int) $request->input('per_page', 20));

        return response()->json([
            'data' => SyncLogResource::collection($logs->items()),
            'meta' => [
                'page' => $logs->currentPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
                'last_page' => $logs->lastPage(),
            ],
        ]);
    }

    /**
     * GET /marketing/sync-logs/{syncLog}
     */
    public function show(MarketingSyncLog $syncLog): JsonResponse
    {
        return response()->json(['data' => new SyncLogResource($syncLog)]);
    }
}
