<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CampaignApprovalDecision extends Model
{
    use HasUuids;

    protected $table = 'marketing_campaign_approval_decisions';

    public $timestamps = false;

    protected $fillable = [
        'campaign_approval_id', 'workflow_step_id',
        'step_order', 'step_name', 'decision',
        'decided_by', 'notes', 'decided_at', 'created_at',
    ];

    protected $casts = [
        'decided_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    public function approval(): BelongsTo
    {
        return $this->belongsTo(CampaignApproval::class, 'campaign_approval_id');
    }
}
