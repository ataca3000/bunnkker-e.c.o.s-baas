<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * @property string $id
 * @property string $marketing_campaign_id
 * @property string $marketing_campaign_ad_set_id
 * @property string $marketing_connection_id
 * @property string $external_ad_id
 * @property string $external_ad_set_id
 * @property string $external_campaign_id
 * @property string $name
 * @property string $status
 * @property string|null $creative_id
 * @property array|null $tracking_specs
 * @property array|null $provider_payload
 */
class CampaignAd extends Model
{
    use HasUuids;

    protected $table = 'marketing_campaign_ads';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'tracking_specs' => 'array',
            'provider_payload' => 'array',
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

    /** @return BelongsTo<CampaignAdSet, $this> */
    public function adSet(): BelongsTo
    {
        return $this->belongsTo(CampaignAdSet::class, 'marketing_campaign_ad_set_id');
    }

    /** @return HasOne<CampaignCreative, $this> */
    public function creative(): HasOne
    {
        return $this->hasOne(CampaignCreative::class, 'marketing_campaign_ad_id');
    }

    /** @return HasMany<CampaignInsight, $this> */
    public function insights(): HasMany
    {
        return $this->hasMany(CampaignInsight::class, 'marketing_campaign_ad_id');
    }
}
