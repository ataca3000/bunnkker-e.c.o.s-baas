<?php

declare(strict_types=1);

namespace Modules\Marketing\Connections\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Modules\Marketing\Connections\Application\Services\ConnectorHealthService;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;

final class ConnectorHealthController extends Controller
{
    public function __construct(
        private readonly ConnectorHealthService $healthService,
    ) {}

    /**
     * GET /marketing/connections/{connection}/health
     *
     * Returns the two-level health snapshot for a connection:
     *   - connector-level (token, API, rate limits, sync history)
     *   - overall status ('healthy' | 'warning' | 'error')
     */
    public function show(string $connection): JsonResponse
    {
        $conn = MarketingConnection::findOrFail($connection);
        $healthData = $this->healthService->check($conn);

        return response()->json([
            'data' => $healthData->toArray(),
        ]);
    }
}
