<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Marketing\Campaigns\Domain\Enums\BusinessGoal;
use Modules\Marketing\Campaigns\Domain\Enums\Season;

/**
 * Campaign Business Context — ECOS Identity Layer.
 *
 * NEVER overwritten by provider sync.
 * One-to-one with Campaign.
 *
 * @property string|null $company_id
 * @property string|null $brand_id
 * @property string|null $channel_id
 * @property string|null $cost_center
 * @property string|null $marketing_team
 * @property string|null $marketing_owner_id
 * @property string|null $business_unit
 * @property Season|null $season
 * @property string|null $custom_season
 * @property BusinessGoal|null $business_goal
 * @property string|null $internal_status
 * @property string|null $internal_priority
 * @property string|null $internal_notes
 * @property array|null $internal_tags
 */
class CampaignBusinessContext extends Model
{
    use HasUuids;

    protected $table = 'marketing_campaign_business_contexts';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'season' => Season::class,
            'business_goal' => BusinessGoal::class,
            'internal_tags' => 'array',
        ];
    }

    /** @return BelongsTo<Campaign, $this> */
    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class, 'marketing_campaign_id');
    }
}
