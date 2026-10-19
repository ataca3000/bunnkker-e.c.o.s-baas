<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApprovalWorkflowStep extends Model
{
    use HasUuids;

    protected $table = 'marketing_approval_workflow_steps';

    protected $fillable = [
        'workflow_template_id', 'step_order', 'step_name',
        'role_required', 'user_id_required',
        'requires_all', 'is_optional', 'timeout_hours', 'on_timeout_action',
    ];

    protected $casts = [
        'requires_all' => 'boolean',
        'is_optional' => 'boolean',
    ];

    public function template(): BelongsTo
    {
        return $this->belongsTo(ApprovalWorkflowTemplate::class, 'workflow_template_id');
    }
}
