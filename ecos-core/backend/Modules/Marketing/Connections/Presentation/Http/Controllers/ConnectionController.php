<?php

declare(strict_types=1);

namespace Modules\Marketing\Connections\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\Connections\Application\Actions\DisconnectConnectionAction;
use Modules\Marketing\Connections\Application\Services\ConnectorRegistry;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;
use Modules\Marketing\Connections\Presentation\Http\Resources\ConnectionResource;

final class ConnectionController extends Controller
{
    public function __construct(
        private readonly DisconnectConnectionAction $disconnect,
        private readonly ConnectorRegistry $registry,
    ) {}

    /**
     * GET /marketing/connections
     */
    public function index(Request $request): JsonResponse
    {
        $connections = MarketingConnection::query()
            ->when($request->has('company_id'), fn ($q) => $q->where('company_id', $request->string('company_id')))
            ->when($request->has('connector_type'), fn ($q) => $q->where('connector_type', $request->string('connector_type')))
            ->when($request->has('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->withCount('assets')
            ->orderByDesc('created_at')
            ->paginate((int) $request->input('per_page', 20));

        return response()->json([
            'data' => ConnectionResource::collection($connections->items()),
            'meta' => [
                'page' => $connections->currentPage(),
                'per_page' => $connections->perPage(),
                'total' => $connections->total(),
                'last_page' => $connections->lastPage(),
            ],
        ]);
    }

    /**
     * GET /marketing/connections/{connection}
     */
    public function show(MarketingConnection $connection): JsonResponse
    {
        $connection->loadCount('assets');

        return response()->json(['data' => new ConnectionResource($connection)]);
    }

    /**
     * POST /marketing/connections/{connection}/validate
     */
    public function validatePermissions(MarketingConnection $connection): JsonResponse
    {
        if (! $this->registry->has($connection->connector_type->value)) {
            return response()->json(['message' => 'No connector registered for this type.'], 422);
        }

        $connector = $this->registry->get($connection->connector_type->value);
        $result = $connector->validatePermissions($connection);

        return response()->json($result);
    }

    /**
     * POST /marketing/connections/{connection}/disconnect
     */
    public function disconnect(Request $request, MarketingConnection $connection): JsonResponse
    {
        $updated = $this->disconnect->execute($connection, (string) (string) $request->user()->id);

        return response()->json([
            'message' => 'Connection disconnected.',
            'data' => new ConnectionResource($updated),
        ]);
    }

    /**
     * GET /marketing/connectors
     * List all registered connector types.
     */
    public function connectors(): JsonResponse
    {
        return response()->json([
            'data' => $this->registry->types(),
        ]);
    }
}
