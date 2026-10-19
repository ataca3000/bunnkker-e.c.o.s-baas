<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CampaignScheduleTask extends Model
{
    use HasUuids;

    protected $table = 'marketing_campaign_schedule_tasks';

    protected $fillable = [
        'campaign_draft_id', 'task_type', 'scheduled_for', 'timezone',
        'status', 'publishing_job_id', 'notes', 'created_by', 'executed_at',
    ];

    protected $casts = [
        'scheduled_for' => 'datetime',
        'executed_at' => 'datetime',
    ];

    public function draft(): BelongsTo
    {
        return $this->belongsTo(CampaignDraft::class, 'campaign_draft_id');
    }
}
