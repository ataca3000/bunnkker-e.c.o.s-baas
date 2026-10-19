<?php

declare(strict_types=1);

namespace Modules\Marketing\Assets\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Marketing\Assets\Domain\Enums\AssetHealth;
use Modules\Marketing\Assets\Domain\Enums\AssetLifecycleStatus;
use Modules\Marketing\Assets\Domain\Enums\AssetType;
use Modules\Marketing\Connections\Domain\Enums\ConnectorType;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;

/**
 * Connector-agnostic marketing asset.
 *
 * Represents any discovered marketing asset — Business Manager, Ad Account,
 * Facebook Page, Instagram, WhatsApp, Pixel, Catalog, Domain, Dataset, App.
 *
 * The `asset_metadata` JSONB column carries connector-specific data (currency,
 * timezone, account_type, etc.) without polluting the core schema.
 *
 * @property string $id
 * @property string|null $company_id
 * @property string $marketing_connection_id
 * @property ConnectorType $connector_type
 * @property AssetType $asset_type
 * @property string $external_id
 * @property string $name
 * @property string $status
 * @property AssetHealth $health_status
 * @property \Carbon\Carbon|null $health_checked_at
 * @property array|null $health_metadata
 * @property array|null $asset_metadata
 * @property \Carbon\Carbon|null $last_synced_at
 * @property \Carbon\Carbon|null $next_sync_at
 */
class MarketingAsset extends Model
{
    use HasUuids;

    protected $table = 'marketing_assets';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'marketing_connection_id',
        'connector_type',
        'asset_type',
        'external_id',
        'name',
        'status',
        'health_status',
        'health_checked_at',
        'health_metadata',
        'asset_metadata',
        'last_synced_at',
        'next_sync_at',
        'is_enabled',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'connector_type' => ConnectorType::class,
            'asset_type' => AssetType::class,
            'status' => AssetLifecycleStatus::class,
            'health_status' => AssetHealth::class,
            'health_checked_at' => 'datetime',
            'last_synced_at' => 'datetime',
            'next_sync_at' => 'datetime',
            'health_metadata' => 'array',
            'asset_metadata' => 'array',
            'is_enabled' => 'boolean',
        ];
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public function isHealthy(): bool
    {
        return $this->health_status === AssetHealth::Healthy;
    }

    public function isActiveLifecycle(): bool
    {
        return $this->status === AssetLifecycleStatus::Active;
    }

    public function preventsSync(): bool
    {
        return $this->status?->preventsSync() ?? false;
    }

    public function needsSync(): bool
    {
        if ($this->preventsSync()) {
            return false;
        }

        return $this->next_sync_at === null || $this->next_sync_at->isPast();
    }

    /** Return a named metadata field from the JSONB column. */
    public function getMeta(string $key, mixed $default = null): mixed
    {
        return $this->asset_metadata[$key] ?? $default;
    }

    // ── Relationships ─────────────────────────────────────────────────────────

    /** @return BelongsTo<MarketingConnection, $this> */
    public function connection(): BelongsTo
    {
        return $this->belongsTo(MarketingConnection::class, 'marketing_connection_id');
    }

    /** @return HasMany<MarketingAssetRelationship, $this> */
    public function relationships(): HasMany
    {
        return $this->hasMany(MarketingAssetRelationship::class, 'marketing_asset_id');
    }

    /** @return HasMany<MarketingAssetRelationship, $this> */
    public function acceptedRelationships(): HasMany
    {
        return $this->hasMany(MarketingAssetRelationship::class, 'marketing_asset_id')
            ->whereNotNull('accepted_at')
            ->whereNull('rejected_at');
    }
}
