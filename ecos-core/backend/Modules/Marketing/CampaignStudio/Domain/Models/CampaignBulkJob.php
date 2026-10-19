<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Modules\Marketing\CampaignStudio\Domain\Enums\BulkOperationType;

class CampaignBulkJob extends Model
{
    use HasUuids;

    protected $table = 'marketing_campaign_bulk_jobs';

    protected $fillable = [
        'company_id', 'operation_type', 'campaign_draft_ids', 'operation_payload',
        'status', 'total_count', 'success_count', 'failure_count',
        'results', 'queued_by', 'started_at', 'completed_at',
    ];

    protected $casts = [
        'operation_type' => BulkOperationType::class,
        'campaign_draft_ids' => 'array',
        'operation_payload' => 'array',
        'results' => 'array',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];
}
