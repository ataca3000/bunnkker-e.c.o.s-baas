<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string $id
 * @property string $marketing_campaign_id
 * @property string $marketing_connection_id
 * @property string $external_ad_set_id
 * @property string $external_campaign_id
 * @property string $name
 * @property string $status
 * @property float|null $daily_budget
 * @property float|null $lifetime_budget
 * @property float|null $bid_amount
 * @property string|null $bid_strategy
 * @property string|null $optimization_goal
 * @property string|null $billing_event
 * @property array|null $targeting
 * @property array|null $provider_payload
 */
class CampaignAdSet extends Model
{
    use HasUuids;

    protected $table = 'marketing_campaign_ad_sets';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'daily_budget' => 'decimal:2',
            'lifetime_budget' => 'decimal:2',
            'bid_amount' => 'decimal:2',
            'targeting' => 'array',
            'schedule' => 'array',
            'provider_payload' => 'array',
            'start_time' => 'datetime',
            'end_time' => 'datetime',
            'provider_created_at' => 'datetime',
            'provider_updated_at' => 'datetime',
            'last_synced_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Campaign, $this> */
    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class, 'marketing_campaign_id');
    }

    /** @return HasMany<CampaignAd, $this> */
    public function ads(): HasMany
    {
        return $this->hasMany(CampaignAd::class, 'marketing_campaign_ad_set_id');
    }

    /** @return HasMany<CampaignInsight, $this> */
    public function insights(): HasMany
    {
        return $this->hasMany(CampaignInsight::class, 'marketing_campaign_ad_set_id');
    }
}
