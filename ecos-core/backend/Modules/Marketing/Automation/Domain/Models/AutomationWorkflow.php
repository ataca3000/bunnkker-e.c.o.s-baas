<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\Marketing\Automation\Domain\Enums\WorkflowStatus;
use Modules\Marketing\Automation\Domain\Enums\WorkflowTriggerType;

class AutomationWorkflow extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'automation_workflows';

    protected $fillable = [
        'name', 'description', 'company_id', 'brand_id',
        'status', 'trigger_type', 'nodes_graph', 'version_number',
        'current_version_id', 'governance_policy_id', 'tags',
        'created_by', 'updated_by', 'activated_at', 'paused_at', 'archived_at',
        'approval_status', 'approved_by', 'approved_at',
        'execution_count', 'last_executed_at',
    ];

    protected $casts = [
        'status' => WorkflowStatus::class,
        'trigger_type' => WorkflowTriggerType::class,
        'nodes_graph' => 'array',
        'tags' => 'array',
        'activated_at' => 'datetime',
        'paused_at' => 'datetime',
        'archived_at' => 'datetime',
        'approved_at' => 'datetime',
        'last_executed_at' => 'datetime',
    ];

    // ── Relationships ──────────────────────────────────────────────────────────

    public function versions(): HasMany
    {
        return $this->hasMany(WorkflowVersion::class, 'workflow_id')->orderByDesc('version_number');
    }

    public function executions(): HasMany
    {
        return $this->hasMany(WorkflowExecution::class, 'workflow_id')->orderByDesc('created_at');
    }

    public function schedule(): HasOne
    {
        return $this->hasOne(WorkflowSchedule::class, 'workflow_id')->where('is_active', true)->latestOfMany('created_at');
    }

    public function eventSubscriptions(): HasMany
    {
        return $this->hasMany(WorkflowEventSubscription::class, 'workflow_id');
    }

    // ── Domain helpers ─────────────────────────────────────────────────────────

    public function isEditable(): bool
    {
        return $this->status->isEditable();
    }

    public function getActiveExecutionsCount(): int
    {
        return $this->executions()->whereIn('status', ['pending', 'running', 'waiting'])->count();
    }
}
