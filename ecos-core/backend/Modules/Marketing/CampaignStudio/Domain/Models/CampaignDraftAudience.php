<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CampaignDraftAudience extends Model
{
    use HasUuids;

    protected $table = 'marketing_campaign_draft_audiences';

    protected $fillable = [
        'campaign_draft_id',
        'countries', 'governorates', 'cities', 'radius_km',
        'age_min', 'age_max', 'genders', 'languages',
        'interests', 'behaviors',
        'lookalike_audiences', 'custom_audiences', 'saved_audiences', 'exclusions',
        'raw_targeting',
    ];

    protected $casts = [
        'countries' => 'array',
        'governorates' => 'array',
        'cities' => 'array',
        'genders' => 'array',
        'languages' => 'array',
        'interests' => 'array',
        'behaviors' => 'array',
        'lookalike_audiences' => 'array',
        'custom_audiences' => 'array',
        'saved_audiences' => 'array',
        'exclusions' => 'array',
        'raw_targeting' => 'array',
    ];

    public function draft(): BelongsTo
    {
        return $this->belongsTo(CampaignDraft::class, 'campaign_draft_id');
    }
}
