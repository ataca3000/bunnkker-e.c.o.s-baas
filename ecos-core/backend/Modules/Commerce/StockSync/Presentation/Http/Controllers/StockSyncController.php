<?php

declare(strict_types=1);

namespace Modules\Commerce\StockSync\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Commerce\StockSync\Application\Actions\ListStockSyncLogsAction;
use Modules\Commerce\StockSync\Application\Actions\SyncStockAction;
use Modules\Commerce\StockSync\Presentation\Http\Resources\StockSyncLogResource;

final class StockSyncController extends Controller
{
    use HasApiResponse;

    public function index(Request $request, ListStockSyncLogsAction $action): JsonResponse
    {
        $filters = [
            'search' => $request->query('search'),
            'channel_id' => $request->query('channel_id'),
            'status' => $request->query('status', 'all'),
            'date_from' => $request->query('date_from'),
            'date_to' => $request->query('date_to'),
            'sort_by' => $request->query('sort_by', 'synced_at'),
            'sort_dir' => $request->query('sort_dir', 'desc'),
            'per_page' => $request->query('per_page', 15),
        ];

        $paginator = $action->execute($filters)->data();

        return $this->success([
            'items' => StockSyncLogResource::collection($paginator->items()),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function syncStock(string $channel, SyncStockAction $action): JsonResponse
    {
        $result = $action->execute($channel);

        return $this->success($result->data(), $result->message());
    }
}
