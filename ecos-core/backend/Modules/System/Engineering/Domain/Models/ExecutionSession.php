<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Modules\System\Engineering\Domain\Enums\ExecutionSessionStatus;

class ExecutionSession extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'engineering_execution_sessions';

    protected $fillable = [
        'company_id',
        'task_id',
        'agent_id',
        'status',
        'workspace_path',
        'git_branch',
        'git_commit',
        'progress_percent',
        'progress_message',
        'cpu_seconds_used',
        'memory_mb_peak',
        'disk_gb_peak',
        'failure_reason',
        'metadata',
        'started_at',
        'paused_at',
        'resumed_at',
        'completed_at',
        'failed_at',
        'aborted_at',
    ];

    protected $casts = [
        'status'           => ExecutionSessionStatus::class,
        'progress_percent' => 'integer',
        'cpu_seconds_used' => 'integer',
        'memory_mb_peak'   => 'integer',
        'disk_gb_peak'     => 'float',
        'metadata'         => 'array',
        'started_at'       => 'datetime',
        'paused_at'        => 'datetime',
        'resumed_at'       => 'datetime',
        'completed_at'     => 'datetime',
        'failed_at'        => 'datetime',
        'aborted_at'       => 'datetime',
    ];

    public function task(): BelongsTo
    {
        return $this->belongsTo(EngineeringTask::class, 'task_id');
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(EngineeringAgent::class, 'agent_id');
    }

    public function artifacts(): HasMany
    {
        return $this->hasMany(EngineeringExecutionArtifact::class, 'session_id');
    }

    public function events(): HasMany
    {
        return $this->hasMany(EngineeringExecutionEvent::class, 'session_id')
            ->orderBy('occurred_at');
    }

    public function workspaceSession(): HasOne
    {
        return $this->hasOne(EngineeringWorkspaceSession::class, 'session_id');
    }

    public function runtimeMetrics(): HasMany
    {
        return $this->hasMany(EngineeringRuntimeMetric::class, 'session_id');
    }

    public function isTerminal(): bool
    {
        return $this->status->isTerminal();
    }

    public function getDurationSecondsAttribute(): ?int
    {
        return $this->started_at && $this->completed_at
            ? $this->started_at->diffInSeconds($this->completed_at)
            : null;
    }
}
