<?php

declare(strict_types=1);

namespace Modules\Marketing\Dashboard\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Modules\Marketing\Assets\Domain\Enums\AssetHealth;
use Modules\Marketing\Assets\Domain\Models\MarketingAsset;
use Modules\Marketing\Assets\Domain\Models\MarketingAssetRelationship;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;
use Modules\Marketing\Synchronization\Domain\Models\MarketingSyncLog;

final class MarketingDashboardController extends Controller
{
    /**
     * GET /marketing/dashboard
     */
    public function index(Request $request): JsonResponse
    {
        $companyId = $request->string('company_id')->toString() ?: null;

        $connectionQuery = MarketingConnection::query()
            ->when($companyId, fn ($q) => $q->where('company_id', $companyId));

        $assetQuery = MarketingAsset::query()
            ->when($companyId, fn ($q) => $q->where('company_id', $companyId));

        // KPI cards
        $totalConnections = (clone $connectionQuery)->count();
        $activeConnections = (clone $connectionQuery)->where('status', 'active')->count();

        $totalAssets = (clone $assetQuery)->count();
        $healthyAssets = (clone $assetQuery)->where('health_status', AssetHealth::Healthy->value)->count();
        $warningAssets = (clone $assetQuery)->whereIn('health_status', [AssetHealth::Warning->value, AssetHealth::Inactive->value])->count();
        $errorAssets = $totalAssets - $healthyAssets - $warningAssets;

        // Pending mapping suggestions
        $pendingSuggestions = MarketingAssetRelationship::whereHas('asset', function ($q) use ($companyId): void {
            $q->when($companyId, fn ($q2) => $q2->where('company_id', $companyId));
        })
            ->where('is_auto_suggested', true)
            ->whereNull('accepted_at')
            ->whereNull('rejected_at')
            ->count();

        // Asset breakdown by type
        $assetsByType = (clone $assetQuery)
            ->select('asset_type', DB::raw('count(*) as total'))
            ->groupBy('asset_type')
            ->pluck('total', 'asset_type');

        // Last sync activity (5 most recent)
        $recentSyncs = MarketingSyncLog::when($companyId, fn ($q) => $q->whereHas(
            'connection',
            fn ($q2) => $q2->where('company_id', $companyId),
        ))
            ->orderByDesc('started_at')
            ->limit(5)
            ->get(['id', 'sync_type', 'status', 'assets_discovered', 'assets_created', 'assets_updated', 'started_at', 'completed_at']);

        return response()->json([
            'kpis' => [
                'total_connections' => $totalConnections,
                'active_connections' => $activeConnections,
                'total_assets' => $totalAssets,
                'healthy_assets' => $healthyAssets,
                'warning_assets' => $warningAssets,
                'error_assets' => $errorAssets,
                'pending_suggestions' => $pendingSuggestions,
            ],
            'assets_by_type' => $assetsByType,
            'recent_syncs' => $recentSyncs,
        ]);
    }
}
