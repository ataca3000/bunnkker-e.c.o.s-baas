<?php

declare(strict_types=1);

namespace Modules\Marketing\MetaConnector\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Modules\Marketing\Assets\Domain\Models\MarketingAsset;
use Modules\Marketing\Connections\Domain\Enums\ConnectorType;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;
use Modules\Marketing\MetaConnector\Application\Jobs\MetaIncrementalSyncJob;
use Modules\Marketing\MetaConnector\Application\Services\MetaPermissionsService;
use Modules\Marketing\MetaConnector\Application\Services\MetaWebhookService;
use Modules\Marketing\MetaConnector\Domain\Models\MetaWebhook;
use Modules\Marketing\ProviderConfig\Application\Services\ProviderHealthMonitor;
use Modules\Marketing\Synchronization\Domain\Enums\SyncStatus;
use Modules\Marketing\Synchronization\Domain\Models\MarketingSyncLog;

/**
 * Meta Connection Dashboard API.
 *
 * All endpoints are scoped to the authenticated user's company.
 */
final class MetaConnectionController extends Controller
{
    public function __construct(
        private readonly MetaPermissionsService $permissions,
        private readonly MetaWebhookService $webhooks,
        private readonly ProviderHealthMonitor $healthMonitor,
    ) {}

    // ── Dashboard ─────────────────────────────────────────────────────────────

    /**
     * GET /marketing/meta/connections/{connection}/dashboard
     *
     * Returns a full dashboard snapshot in one request.
     */
    public function dashboard(Request $request, string $connectionId): JsonResponse
    {
        $connection = $this->resolveConnection($request, $connectionId);
        if ($connection === null) {
            return response()->json(['message' => 'Connection not found.'], 404);
        }

        $companyId = (string) $request->user()->company_id;

        // Assets summary
        $assetsQuery = MarketingAsset::where('marketing_connection_id', $connection->id);
        $totalAssets = $assetsQuery->count();
        $byType = $assetsQuery->select('asset_type', DB::raw('count(*) as count'))
            ->groupBy('asset_type')
            ->pluck('count', 'asset_type')
            ->toArray();

        // Sync history
        $recentSyncs = MarketingSyncLog::where('marketing_connection_id', $connection->id)
            ->orderByDesc('started_at')
            ->limit(5)
            ->get(['id', 'sync_type', 'status', 'started_at', 'completed_at', 'assets_discovered', 'error_message']);

        // Webhook status
        $webhookList = $this->webhooks->listForConnection($connection);

        // Provider health
        $health = $this->healthMonitor->check($companyId, 'meta');

        // Recent events from ProviderPlatform
        $recentEvents = DB::table('marketing_provider_events')
            ->where('company_id', $companyId)
            ->where('provider', 'meta')
            ->orderByDesc('occurred_at')
            ->limit(10)
            ->get(['event_name', 'current_status', 'previous_status', 'occurred_at', 'metadata'])
            ->toArray();

        // Errors from sync logs
        $recentErrors = MarketingSyncLog::where('marketing_connection_id', $connection->id)
            ->whereNotNull('error_message')
            ->orderByDesc('started_at')
            ->limit(5)
            ->get(['started_at', 'error_message', 'sync_type']);

        return response()->json([
            'connection' => [
                'id' => $connection->id,
                'label' => $connection->label,
                'status' => $connection->status,
                'connected_at' => $connection->connected_at?->toISOString(),
                'last_synced_at' => $connection->last_synced_at?->toISOString(),
                'token_expires_at' => $connection->token_expires_at?->toISOString(),
                'external_account_id' => $connection->external_account_id,
                'connector_meta' => $connection->connector_meta,
            ],
            'health' => $health,
            'assets' => [
                'total' => $totalAssets,
                'by_type' => $byType,
            ],
            'webhooks' => $webhookList->map(fn (MetaWebhook $w) => [
                'id' => $w->id,
                'object_type' => $w->object_type,
                'object_id' => $w->object_id,
                'status' => $w->status,
                'subscribed_fields' => $w->subscribed_fields,
                'verified_at' => $w->verified_at?->toISOString(),
                'last_delivery_at' => $w->last_delivery_at?->toISOString(),
                'last_error' => $w->last_error,
                'retry_count' => $w->retry_count,
            ])->values(),
            'recent_syncs' => $recentSyncs,
            'recent_events' => $recentEvents,
            'recent_errors' => $recentErrors,
        ]);
    }

    // ── Business Selection ────────────────────────────────────────────────────

    /**
     * GET /marketing/meta/connections/{connection}/businesses
     *
     * List businesses discovered in this connection (from marketing_assets).
     */
    public function businesses(Request $request, string $connectionId): JsonResponse
    {
        $connection = $this->resolveConnection($request, $connectionId);
        if ($connection === null) {
            return response()->json(['message' => 'Connection not found.'], 404);
        }

        $businesses = MarketingAsset::where('marketing_connection_id', $connection->id)
            ->where('asset_type', 'business_account')
            ->orderBy('name')
            ->get(['id', 'external_id', 'name', 'status', 'is_enabled', 'asset_metadata']);

        $selectedIds = $connection->connector_meta['selected_business_ids'] ?? null;

        return response()->json([
            'businesses' => $businesses,
            'selected_ids' => $selectedIds,
        ]);
    }

    /**
     * POST /marketing/meta/connections/{connection}/businesses/select
     *
     * Persist the business selection in connector_meta.
     */
    public function selectBusinesses(Request $request, string $connectionId): JsonResponse
    {
        $request->validate([
            'business_ids' => ['required', 'array'],
            'business_ids.*' => ['string'],
        ]);

        $connection = $this->resolveConnection($request, $connectionId);
        if ($connection === null) {
            return response()->json(['message' => 'Connection not found.'], 404);
        }

        $meta = $connection->connector_meta ?? [];
        $meta['selected_business_ids'] = $request->input('business_ids');

        $connection->update(['connector_meta' => $meta]);

        return response()->json(['message' => 'Business selection saved.', 'selected_ids' => $meta['selected_business_ids']]);
    }

    // ── Asset Management ──────────────────────────────────────────────────────

    /**
     * GET /marketing/meta/connections/{connection}/assets
     *
     * List assets, grouped by type, with enable/disable state.
     */
    public function assets(Request $request, string $connectionId): JsonResponse
    {
        $connection = $this->resolveConnection($request, $connectionId);
        if ($connection === null) {
            return response()->json(['message' => 'Connection not found.'], 404);
        }

        $query = MarketingAsset::where('marketing_connection_id', $connection->id)
            ->orderBy('asset_type')
            ->orderBy('name');

        if ($request->has('asset_type')) {
            $query->where('asset_type', $request->string('asset_type')->toString());
        }

        $assets = $query->get([
            'id', 'external_id', 'name', 'asset_type', 'status',
            'is_enabled', 'health_status', 'last_synced_at', 'asset_metadata',
        ]);

        return response()->json([
            'assets' => $assets,
            'total' => $assets->count(),
        ]);
    }

    /**
     * PATCH /marketing/meta/assets/{asset}/toggle
     *
     * Enable or disable a single asset.
     */
    public function toggleAsset(Request $request, string $assetId): JsonResponse
    {
        $request->validate([
            'is_enabled' => ['required', 'boolean'],
        ]);

        $asset = MarketingAsset::where('id', $assetId)
            ->where('company_id', (string) $request->user()->company_id)
            ->first();

        if ($asset === null) {
            return response()->json(['message' => 'Asset not found.'], 404);
        }

        $asset->update(['is_enabled' => $request->boolean('is_enabled')]);

        return response()->json([
            'message' => 'Asset updated.',
            'id' => $asset->id,
            'is_enabled' => $asset->is_enabled,
        ]);
    }

    // ── Permissions ───────────────────────────────────────────────────────────

    /**
     * GET /marketing/meta/connections/{connection}/permissions
     *
     * Verify permissions against the live Meta API.
     */
    public function permissions(Request $request, string $connectionId): JsonResponse
    {
        $connection = $this->resolveConnection($request, $connectionId);
        if ($connection === null) {
            return response()->json(['message' => 'Connection not found.'], 404);
        }

        $result = $this->permissions->verify($connection);

        return response()->json($result);
    }

    /**
     * GET /marketing/meta/connections/{connection}/permissions/required
     *
     * Returns the required and optional scope definitions.
     */
    public function requiredPermissions(): JsonResponse
    {
        return response()->json($this->permissions->getRequiredScopes());
    }

    // ── Sync Status ───────────────────────────────────────────────────────────

    /**
     * GET /marketing/meta/connections/{connection}/sync-status
     *
     * Lightweight polling endpoint — returns whether a sync is running and the
     * last sync summary. The frontend uses this with exponential backoff instead
     * of fixed-interval polling of the heavier /businesses or /dashboard endpoints.
     */
    public function syncStatus(Request $request, string $connectionId): JsonResponse
    {
        $connection = $this->resolveConnection($request, $connectionId);
        if ($connection === null) {
            return response()->json(['message' => 'Connection not found.'], 404);
        }

        $lastSync = MarketingSyncLog::where('marketing_connection_id', $connection->id)
            ->orderByDesc('started_at')
            ->first();

        $isRunning = $lastSync !== null && in_array($lastSync->status, [
            SyncStatus::Pending,
            SyncStatus::Running,
        ], true);

        return response()->json([
            'is_running' => $isRunning,
            'last_sync' => $lastSync ? [
                'id' => $lastSync->id,
                'sync_type' => $lastSync->sync_type->value,
                'status' => $lastSync->status->value,
                'started_at' => $lastSync->started_at?->toISOString(),
                'completed_at' => $lastSync->completed_at?->toISOString(),
                'assets_discovered' => $lastSync->assets_discovered,
                'error_message' => $lastSync->error_message,
            ] : null,
        ]);
    }

    // ── Manual Sync ───────────────────────────────────────────────────────────

    /**
     * POST /marketing/meta/connections/{connection}/sync
     *
     * Dispatch an incremental sync job for this connection.
     */
    public function sync(Request $request, string $connectionId): JsonResponse
    {
        $connection = $this->resolveConnection($request, $connectionId);
        if ($connection === null) {
            return response()->json(['message' => 'Connection not found.'], 404);
        }

        $companyId = (string) $request->user()->company_id;

        MetaIncrementalSyncJob::dispatch($connection->id, $companyId);

        return response()->json(['message' => 'Sync dispatched.', 'connection_id' => $connection->id]);
    }

    // ── Failure Recovery ──────────────────────────────────────────────────────

    /**
     * GET /marketing/meta/connections/{connection}/recovery
     *
     * Returns recommended recovery actions based on current connection state.
     */
    public function recovery(Request $request, string $connectionId): JsonResponse
    {
        $connection = $this->resolveConnection($request, $connectionId);
        if ($connection === null) {
            return response()->json(['message' => 'Connection not found.'], 404);
        }

        $actions = $this->buildRecoveryActions($connection);

        return response()->json([
            'status' => $connection->status,
            'actions' => $actions,
        ]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function resolveConnection(Request $request, string $connectionId): ?MarketingConnection
    {
        return MarketingConnection::where('id', $connectionId)
            ->where('company_id', (string) $request->user()->company_id)
            ->where('connector_type', ConnectorType::Meta->value)
            ->first();
    }

    private function buildRecoveryActions(MarketingConnection $connection): array
    {
        $status = $connection->status->value;
        $actions = [];

        if ($status === 'expired') {
            $actions[] = [
                'key' => 'reconnect',
                'label' => 'Reconnect Meta Account',
                'description' => 'Your Meta access token has expired. Click Reconnect to re-authorize.',
                'severity' => 'critical',
                'can_auto' => true,
            ];
        }

        if ($status === 'warning') {
            $actions[] = [
                'key' => 'verify_permissions',
                'label' => 'Verify & Request Permissions',
                'description' => 'One or more required permissions are missing. Check the Permissions tab.',
                'severity' => 'warning',
                'can_auto' => false,
            ];
            $actions[] = [
                'key' => 'reconnect',
                'label' => 'Reconnect to Re-request Permissions',
                'description' => 'Reconnecting will re-request all required permissions from Meta.',
                'severity' => 'warning',
                'can_auto' => true,
            ];
        }

        if ($status === 'disconnected') {
            $actions[] = [
                'key' => 'reconnect',
                'label' => 'Reconnect Meta Account',
                'description' => 'The connection is disconnected. Click Reconnect to restore it.',
                'severity' => 'critical',
                'can_auto' => true,
            ];
        }

        // Check webhook health
        $failedWebhooks = MetaWebhook::where('marketing_connection_id', $connection->id)
            ->whereIn('status', ['failed', 'inactive'])
            ->count();

        if ($failedWebhooks > 0) {
            $actions[] = [
                'key' => 're_register_webhooks',
                'label' => "Re-register {$failedWebhooks} Failed Webhook(s)",
                'description' => 'Some webhook subscriptions are not active. Re-register to restore real-time updates.',
                'severity' => 'warning',
                'can_auto' => true,
            ];
        }

        // Suggest sync if stale
        if ($connection->last_synced_at === null || $connection->last_synced_at->diffInHours(now()) > 24) {
            $actions[] = [
                'key' => 'sync',
                'label' => 'Run Sync Now',
                'description' => 'Asset data may be stale. Run a sync to refresh.',
                'severity' => 'info',
                'can_auto' => true,
            ];
        }

        if (empty($actions)) {
            $actions[] = [
                'key' => 'none',
                'label' => 'Everything looks good',
                'description' => 'No recovery actions required.',
                'severity' => 'success',
                'can_auto' => false,
            ];
        }

        return $actions;
    }
}
