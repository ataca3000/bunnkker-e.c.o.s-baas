<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Marketing\CampaignStudio\Domain\Enums\VersionChangeType;

class CampaignVersion extends Model
{
    use HasUuids;

    protected $table = 'marketing_campaign_versions';

    public $timestamps = false;

    protected $fillable = [
        'campaign_draft_id', 'version_number', 'change_type',
        'snapshot', 'changed_fields', 'change_note',
        'changed_by_user_id', 'approval_decision',
        'approved_by_user_id', 'approval_decided_at', 'created_at',
    ];

    protected $casts = [
        'change_type' => VersionChangeType::class,
        'snapshot' => 'array',
        'changed_fields' => 'array',
        'approval_decided_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    public function draft(): BelongsTo
    {
        return $this->belongsTo(CampaignDraft::class, 'campaign_draft_id');
    }
}
