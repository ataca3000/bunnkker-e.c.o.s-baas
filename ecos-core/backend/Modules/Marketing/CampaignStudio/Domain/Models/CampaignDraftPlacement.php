<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Marketing\CampaignStudio\Domain\Enums\PlacementMode;

class CampaignDraftPlacement extends Model
{
    use HasUuids;

    protected $table = 'marketing_campaign_draft_placements';

    protected $fillable = [
        'campaign_draft_id', 'placement_mode',
        'facebook_feed', 'instagram_feed',
        'facebook_stories', 'instagram_stories',
        'facebook_reels', 'instagram_reels',
        'messenger_inbox', 'audience_network',
        'excluded_placements',
    ];

    protected $casts = [
        'placement_mode' => PlacementMode::class,
        'facebook_feed' => 'boolean',
        'instagram_feed' => 'boolean',
        'facebook_stories' => 'boolean',
        'instagram_stories' => 'boolean',
        'facebook_reels' => 'boolean',
        'instagram_reels' => 'boolean',
        'messenger_inbox' => 'boolean',
        'audience_network' => 'boolean',
        'excluded_placements' => 'array',
    ];

    public function draft(): BelongsTo
    {
        return $this->belongsTo(CampaignDraft::class, 'campaign_draft_id');
    }

    public function getEnabledPlacements(): array
    {
        if ($this->placement_mode === PlacementMode::AUTO) {
            return ['auto'];
        }

        $placements = [];
        foreach (['facebook_feed', 'instagram_feed', 'facebook_stories', 'instagram_stories', 'facebook_reels', 'instagram_reels', 'messenger_inbox', 'audience_network'] as $key) {
            if ($this->{$key}) {
                $placements[] = $key;
            }
        }

        return $placements;
    }
}
