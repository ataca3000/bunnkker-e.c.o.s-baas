<?php

declare(strict_types=1);

namespace Modules\Marketing\Assets\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\Assets\Application\Services\AssetHealthService;
use Modules\Marketing\Assets\Domain\Models\MarketingAsset;
use Modules\Marketing\Assets\Presentation\Http\Resources\MarketingAssetResource;

final class MarketingAssetController extends Controller
{
    public function __construct(private readonly AssetHealthService $healthService) {}

    /**
     * GET /marketing/assets
     */
    public function index(Request $request): JsonResponse
    {
        $assets = MarketingAsset::query()
            ->when($request->has('company_id'), fn ($q) => $q->where('company_id', $request->string('company_id')))
            ->when($request->has('connector_type'), fn ($q) => $q->where('connector_type', $request->string('connector_type')))
            ->when($request->has('asset_type'), fn ($q) => $q->where('asset_type', $request->string('asset_type')))
            ->when($request->has('health_status'), fn ($q) => $q->where('health_status', $request->string('health_status')))
            ->when($request->has('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->string('search'), fn ($q, $s) => $q->where('name', 'ilike', "%{$s}%"))
            ->with('connection:id,label,connector_type,status')
            ->withCount('relationships')
            ->orderByDesc('created_at')
            ->paginate((int) $request->input('per_page', 50));

        return response()->json([
            'data' => MarketingAssetResource::collection($assets->items()),
            'meta' => [
                'page' => $assets->currentPage(),
                'per_page' => $assets->perPage(),
                'total' => $assets->total(),
                'last_page' => $assets->lastPage(),
            ],
        ]);
    }

    /**
     * GET /marketing/assets/{asset}
     */
    public function show(MarketingAsset $marketingAsset): JsonResponse
    {
        $marketingAsset->load([
            'connection:id,label,connector_type,status',
            'relationships',
        ]);

        return response()->json(['data' => new MarketingAssetResource($marketingAsset)]);
    }

    /**
     * POST /marketing/assets/{asset}/check-health
     */
    public function checkHealth(MarketingAsset $marketingAsset): JsonResponse
    {
        $health = $this->healthService->check($marketingAsset);

        return response()->json([
            'health_status' => $health,
            'health_checked_at' => now()->toIso8601String(),
        ]);
    }
}
