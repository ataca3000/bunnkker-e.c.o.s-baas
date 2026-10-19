<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CampaignDraftCreative extends Model
{
    use HasUuids;

    protected $table = 'marketing_campaign_draft_creatives';

    protected $fillable = [
        'campaign_draft_id', 'creative_type', 'name',
        'headline', 'primary_text', 'description', 'call_to_action',
        'destination_url', 'utm_params', 'media_items', 'asset_ids',
        'status', 'sort_order',
    ];

    protected $casts = [
        'utm_params' => 'array',
        'media_items' => 'array',
        'asset_ids' => 'array',
    ];

    public function draft(): BelongsTo
    {
        return $this->belongsTo(CampaignDraft::class, 'campaign_draft_id');
    }
}
