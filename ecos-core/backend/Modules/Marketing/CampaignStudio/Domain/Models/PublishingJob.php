<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Marketing\CampaignStudio\Domain\Enums\PublishingJobStatus;
use Modules\Marketing\CampaignStudio\Domain\Enums\PublishingOperation;

class PublishingJob extends Model
{
    use HasUuids;

    protected $table = 'marketing_publishing_jobs';

    protected $fillable = [
        'campaign_draft_id', 'operation', 'status',
        'connector_type', 'connection_id',
        'payload', 'result', 'error_message', 'error_context',
        'attempt_count', 'max_attempts', 'next_retry_at',
        'scheduled_at', 'scheduled_timezone',
        'queued_by', 'started_at', 'completed_at',
    ];

    protected $casts = [
        'operation' => PublishingOperation::class,
        'status' => PublishingJobStatus::class,
        'payload' => 'array',
        'result' => 'array',
        'error_context' => 'array',
        'next_retry_at' => 'datetime',
        'scheduled_at' => 'datetime',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function draft(): BelongsTo
    {
        return $this->belongsTo(CampaignDraft::class, 'campaign_draft_id');
    }

    public function canRetry(): bool
    {
        return $this->status === PublishingJobStatus::FAILED
            && $this->attempt_count < $this->max_attempts;
    }
}
