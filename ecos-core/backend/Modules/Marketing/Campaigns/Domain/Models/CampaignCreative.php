<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Marketing\Campaigns\Domain\Enums\CreativeType;

/**
 * Campaign Creative — Creative Library Entity.
 *
 * The `provider_payload` column is IMMUTABLE.
 * Prepared for future AI creative analysis (headline scoring, visual analysis, A/B comparison).
 *
 * @property string $external_creative_id
 * @property CreativeType $creative_type
 * @property string|null $headline
 * @property string|null $primary_text
 * @property string|null $call_to_action
 * @property string|null $image_url
 * @property string|null $video_url
 * @property string|null $thumbnail_url
 * @property array|null $asset_feed
 * @property array|null $provider_payload
 */
class CampaignCreative extends Model
{
    use HasUuids;

    protected $table = 'marketing_campaign_creatives';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'creative_type' => CreativeType::class,
            'asset_feed' => 'array',
            'provider_payload' => 'array',
            'last_synced_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Campaign, $this> */
    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class, 'marketing_campaign_id');
    }

    /** @return BelongsTo<CampaignAd, $this> */
    public function ad(): BelongsTo
    {
        return $this->belongsTo(CampaignAd::class, 'marketing_campaign_ad_id');
    }

    public function hasMedia(): bool
    {
        return $this->image_url !== null || $this->video_url !== null;
    }
}
