<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Marketing\CampaignStudio\Domain\Enums\ApprovalStatus;

class CampaignApproval extends Model
{
    use HasUuids;

    protected $table = 'marketing_campaign_approvals';

    protected $fillable = [
        'campaign_draft_id', 'workflow_template_id',
        'current_step_order', 'status',
        'submitted_by', 'submitted_at', 'completed_at', 'rejection_reason',
    ];

    protected $casts = [
        'status' => ApprovalStatus::class,
        'submitted_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function draft(): BelongsTo
    {
        return $this->belongsTo(CampaignDraft::class, 'campaign_draft_id');
    }

    public function workflowTemplate(): BelongsTo
    {
        return $this->belongsTo(ApprovalWorkflowTemplate::class, 'workflow_template_id');
    }

    public function decisions(): HasMany
    {
        return $this->hasMany(CampaignApprovalDecision::class)->orderBy('step_order');
    }
}
