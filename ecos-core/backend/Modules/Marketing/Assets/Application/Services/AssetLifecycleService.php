<?php

declare(strict_types=1);

namespace Modules\Marketing\Assets\Application\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Modules\Marketing\Assets\Domain\Enums\AssetLifecycleStatus;
use Modules\Marketing\Assets\Domain\Enums\AssetType;
use Modules\Marketing\Assets\Domain\Models\MarketingAsset;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;
use Modules\Marketing\ProviderPlatform\Application\Services\ProviderEventPublisher;
use Throwable;

/**
 * Manages lifecycle transitions for all marketing assets.
 *
 * Rules enforced:
 *  - Assets are NEVER deleted — only transitioned between states.
 *  - Every transition is recorded in marketing_audit_logs.
 *  - Every significant transition emits a ProviderPlatform event.
 *  - Ghost detection (Full sync) marks unseen assets REMOVED_FROM_PROVIDER.
 *  - Business removal cascades DISCONNECTED to all child assets.
 *  - Reconnection (asset seen again after removal/revocation) → back to ACTIVE.
 */
final class AssetLifecycleService
{
    public function __construct(
        private readonly ProviderEventPublisher $events,
    ) {}

    // ── Core transition ───────────────────────────────────────────────────────

    /**
     * Transition an asset to a new lifecycle status.
     * No-ops if the asset is already in the target status.
     * Writes audit entry and emits provider event on every real transition.
     */
    public function transition(
        MarketingAsset $asset,
        AssetLifecycleStatus $newStatus,
        string $reason,
        ?string $actorId = null,
    ): void {
        $previousStatus = $asset->status instanceof AssetLifecycleStatus
            ? $asset->status->value
            : (string) $asset->status;

        if ($previousStatus === $newStatus->value) {
            return;
        }

        $asset->update(['status' => $newStatus->value]);

        $this->writeAuditEntry($asset, $previousStatus, $newStatus->value, $reason, $actorId);
        $this->emitEvent($asset, $previousStatus, $newStatus, $reason);
    }

    // ── Ghost detection ───────────────────────────────────────────────────────

    /**
     * After a Full sync, mark all currently ACTIVE assets for this connection
     * that were NOT seen in the sync response as REMOVED_FROM_PROVIDER.
     *
     * Terminal assets (already removed/revoked/archived) are untouched.
     * Cascades DISCONNECTED to child assets when a BusinessAccount is ghosted.
     *
     * @param  list<string>  $seenExternalIds  All external IDs returned by this sync
     * @return int Number of assets newly marked as removed
     */
    public function markGhosts(string $connectionId, array $seenExternalIds): int
    {
        $ghosts = MarketingAsset::where('marketing_connection_id', $connectionId)
            ->where('status', AssetLifecycleStatus::Active->value)
            ->whereNotIn('external_id', $seenExternalIds)
            ->get();

        $count = 0;

        foreach ($ghosts as $ghost) {
            $this->transition(
                $ghost,
                AssetLifecycleStatus::RemovedFromProvider,
                'Not found in latest full sync',
            );
            $count++;

            // Cascade DISCONNECTED to children when a Business Account disappears
            if ($ghost->asset_type === AssetType::BusinessAccount) {
                $this->cascadeFromBusiness(
                    $ghost->external_id,
                    AssetLifecycleStatus::Disconnected,
                    "Parent business [{$ghost->name}] removed from provider",
                );
            }
        }

        if ($count > 0) {
            Log::info("AssetLifecycleService: {$count} ghost(s) marked REMOVED_FROM_PROVIDER for connection [{$connectionId}].");
        }

        return $count;
    }

    // ── Reconnection ──────────────────────────────────────────────────────────

    /**
     * Called when an asset that was previously non-active is seen again in a sync.
     * Transitions back to ACTIVE and emits ProviderAssetReconnected.
     */
    public function handleReconnected(MarketingAsset $asset, string $previousStatus): void
    {
        $this->transition(
            $asset,
            AssetLifecycleStatus::Active,
            "Asset seen again in sync (was {$previousStatus})",
        );
    }

    // ── Cascade ───────────────────────────────────────────────────────────────

    /**
     * Cascade a lifecycle status to all ACTIVE assets under a given business.
     * Matches via asset_metadata->business_id (PostgreSQL JSONB).
     *
     * @return int Number of child assets transitioned
     */
    public function cascadeFromBusiness(
        string $businessExternalId,
        AssetLifecycleStatus $status,
        string $reason,
    ): int {
        $children = MarketingAsset::where('status', AssetLifecycleStatus::Active->value)
            ->whereRaw("asset_metadata->>'business_id' = ?", [$businessExternalId])
            ->get();

        foreach ($children as $child) {
            $this->transition($child, $status, $reason);
        }

        return $children->count();
    }

    // ── Audit log ─────────────────────────────────────────────────────────────

    private function writeAuditEntry(
        MarketingAsset $asset,
        string $previousStatus,
        string $newStatus,
        string $reason,
        ?string $actorId,
    ): void {
        try {
            DB::table('marketing_audit_logs')->insert([
                'id' => (string) Str::uuid(),
                'entity_type' => 'asset',
                'entity_id' => $asset->id,
                'connection_id' => $asset->marketing_connection_id,
                'asset_id' => $asset->id,
                'action' => 'lifecycle_transition',
                'actor_id' => $actorId,
                'actor_name' => $actorId ? null : 'system',
                'before' => json_encode(['status' => $previousStatus]),
                'after' => json_encode(['status' => $newStatus]),
                'reason' => $reason,
                'connector_type' => $asset->connector_type?->value,
                'created_at' => now(),
            ]);
        } catch (Throwable $e) {
            Log::error('AssetLifecycleService: failed to write audit entry', [
                'asset_id' => $asset->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    // ── Provider event dispatch ───────────────────────────────────────────────

    private function emitEvent(
        MarketingAsset $asset,
        string $previousStatus,
        AssetLifecycleStatus $newStatus,
        string $reason,
    ): void {
        $connection = MarketingConnection::find($asset->marketing_connection_id);
        if ($connection === null) {
            return;
        }

        $companyId = (string) $asset->company_id;
        $provider = $connection->connector_type->value;
        $connectionId = $asset->marketing_connection_id;
        $assetMeta = [
            'asset_type' => $asset->asset_type?->value,
            'external_id' => $asset->external_id,
            'asset_name' => $asset->name,
        ];

        match ($newStatus) {
            AssetLifecycleStatus::Active => $this->events->providerAssetReconnected(
                $companyId, $provider, $connectionId, $assetMeta, $previousStatus,
            ),
            AssetLifecycleStatus::RemovedFromProvider => $this->events->providerAssetRemoved(
                $companyId, $provider, $connectionId, $assetMeta, $reason,
            ),
            AssetLifecycleStatus::AccessRevoked => $this->events->providerAssetPermissionRevoked(
                $companyId, $provider, $connectionId, $assetMeta, $reason,
            ),
            AssetLifecycleStatus::Disconnected => $this->events->providerAssetDisconnected(
                $companyId, $provider, $connectionId, $assetMeta, $reason,
            ),
            default => $this->events->providerAssetStatusChanged(
                $companyId, $provider, $connectionId, $assetMeta, $previousStatus, $newStatus->value, $reason,
            ),
        };
    }
}
