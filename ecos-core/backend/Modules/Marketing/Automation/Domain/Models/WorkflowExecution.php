<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Marketing\Automation\Domain\Enums\WorkflowExecutionStatus;

class WorkflowExecution extends Model
{
    use HasUuids;

    protected $table = 'automation_workflow_executions';

    protected $fillable = [
        'workflow_id', 'workflow_version_id', 'entity_type', 'entity_id',
        'status', 'trigger_type', 'trigger_payload', 'current_node_id',
        'step_count', 'triggered_by', 'started_at', 'completed_at', 'failed_at', 'error_message',
    ];

    protected $casts = [
        'status' => WorkflowExecutionStatus::class,
        'trigger_payload' => 'array',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'failed_at' => 'datetime',
    ];

    public function workflow(): BelongsTo
    {
        return $this->belongsTo(AutomationWorkflow::class, 'workflow_id');
    }

    public function steps(): HasMany
    {
        return $this->hasMany(WorkflowExecutionStep::class, 'execution_id')->orderBy('executed_at');
    }

    public function isActive(): bool
    {
        return $this->status->isActive();
    }

    public function canRetry(): bool
    {
        return $this->status->canRetry();
    }
}
