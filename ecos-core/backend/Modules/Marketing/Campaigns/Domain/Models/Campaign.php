<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Modules\Marketing\Campaigns\Domain\Enums\CampaignObjective;
use Modules\Marketing\Campaigns\Domain\Enums\CampaignStatus;
use Modules\Marketing\Connections\Domain\Enums\ConnectorType;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;
use Modules\Marketing\Initiatives\Domain\Models\MarketingInitiative;

/**
 * Campaign — dual-identity business entity.
 *
 * Provider Identity: external_campaign_id, status, objective, budgets, schedule (READ-ONLY)
 * Business Identity: see CampaignBusinessContext (ECOS-managed, never overwritten by sync)
 *
 * @property string $id
 * @property string|null $marketing_connection_id
 * @property string|null $marketing_initiative_id
 * @property string|null $company_id
 * @property ConnectorType $connector_type
 * @property string $external_campaign_id
 * @property string|null $external_account_id
 * @property string $name
 * @property CampaignStatus $status
 * @property CampaignObjective|null $objective
 * @property string|null $buying_type
 * @property string|null $bid_strategy
 * @property float|null $daily_budget
 * @property float|null $lifetime_budget
 * @property float|null $budget_remaining
 * @property \Carbon\Carbon|null $start_time
 * @property \Carbon\Carbon|null $stop_time
 * @property \Carbon\Carbon|null $provider_created_at
 * @property \Carbon\Carbon|null $provider_updated_at
 * @property \Carbon\Carbon|null $last_synced_at
 * @property \Carbon\Carbon|null $next_sync_at
 * @property string|null $health_status
 * @property array|null $provider_payload
 */
class Campaign extends Model
{
    use HasUuids;

    protected $table = 'marketing_campaigns';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'connector_type' => ConnectorType::class,
            'status' => CampaignStatus::class,
            'objective' => CampaignObjective::class,
            'daily_budget' => 'decimal:2',
            'lifetime_budget' => 'decimal:2',
            'budget_remaining' => 'decimal:2',
            'special_ad_categories' => 'array',
            'start_time' => 'datetime',
            'stop_time' => 'datetime',
            'provider_created_at' => 'datetime',
            'provider_updated_at' => 'datetime',
            'last_synced_at' => 'datetime',
            'next_sync_at' => 'datetime',
            'provider_payload' => 'array',
        ];
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public function isActive(): bool
    {
        return $this->status === CampaignStatus::Active;
    }

    public function needsSync(): bool
    {
        return $this->next_sync_at === null || $this->next_sync_at->isPast();
    }

    public function budgetDisplay(): string
    {
        if ($this->daily_budget !== null) {
            return 'Daily: '.number_format((float) $this->daily_budget, 2);
        }
        if ($this->lifetime_budget !== null) {
            return 'Lifetime: '.number_format((float) $this->lifetime_budget, 2);
        }

        return '—';
    }

    // ── Relationships ─────────────────────────────────────────────────────────

    /** @return BelongsTo<MarketingConnection, $this> */
    public function connection(): BelongsTo
    {
        return $this->belongsTo(MarketingConnection::class, 'marketing_connection_id');
    }

    /** @return HasMany<CampaignAdSet, $this> */
    public function adSets(): HasMany
    {
        return $this->hasMany(CampaignAdSet::class, 'marketing_campaign_id');
    }

    /** @return HasMany<CampaignAd, $this> */
    public function ads(): HasMany
    {
        return $this->hasMany(CampaignAd::class, 'marketing_campaign_id');
    }

    /** @return HasOne<CampaignBusinessContext, $this> */
    public function businessContext(): HasOne
    {
        return $this->hasOne(CampaignBusinessContext::class, 'marketing_campaign_id');
    }

    /** @return HasMany<CampaignInsight, $this> */
    public function insights(): HasMany
    {
        return $this->hasMany(CampaignInsight::class, 'marketing_campaign_id');
    }

    /** @return HasMany<CampaignCreative, $this> */
    public function creatives(): HasMany
    {
        return $this->hasMany(CampaignCreative::class, 'marketing_campaign_id');
    }

    /** @return BelongsTo<MarketingInitiative, $this> */
    public function initiative(): BelongsTo
    {
        return $this->belongsTo(MarketingInitiative::class, 'marketing_initiative_id');
    }

    /** Latest insights snapshot for campaign level. */
    public function latestInsight(): ?CampaignInsight
    {
        return $this->insights()
            ->where('level', 'campaign')
            ->latest('synced_at')
            ->first();
    }
}
