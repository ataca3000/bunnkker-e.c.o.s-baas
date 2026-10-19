<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\System\Engineering\Domain\Enums\WorkerStatus;

final class EngineeringWorker extends Model
{
    use HasFactory;
    use HasUuids;
    use SoftDeletes;

    protected $table = 'engineering_workers';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'company_id',
        'name',
        'worker_type',
        'status',
        'current_task_id',
        'current_session_id',
        'workspace_base_path',
        'machine_id',
        'max_concurrent_tasks',
        'cpu_limit_percent',
        'memory_limit_mb',
        'disk_limit_gb',
        'max_execution_minutes',
        'capabilities',
        'metadata',
        'last_heartbeat_at',
        'started_at',
        'stopped_at',
        'total_tasks_completed',
        'total_tasks_failed',
    ];

    protected $hidden = [];

    protected function casts(): array
    {
        return [
            'status'                => WorkerStatus::class,
            'capabilities'          => 'array',
            'metadata'              => 'array',
            'last_heartbeat_at'     => 'datetime',
            'started_at'            => 'datetime',
            'stopped_at'            => 'datetime',
            'max_concurrent_tasks'  => 'integer',
            'memory_limit_mb'       => 'integer',
            'disk_limit_gb'         => 'integer',
            'max_execution_minutes' => 'integer',
            'cpu_limit_percent'     => 'float',
            'total_tasks_completed' => 'integer',
            'total_tasks_failed'    => 'integer',
        ];
    }

    // Relations

    public function currentTask(): BelongsTo
    {
        return $this->belongsTo(EngineeringTask::class, 'current_task_id');
    }

    public function currentSession(): BelongsTo
    {
        return $this->belongsTo(EngineeringWorkerSession::class, 'current_session_id');
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(EngineeringWorkerSession::class);
    }

    public function queueEntries(): HasMany
    {
        return $this->hasMany(EngineeringExecutionQueue::class);
    }

    public function workspaceLock(): HasOne
    {
        return $this->hasOne(EngineeringWorkspaceLock::class);
    }

    public function branchLocks(): HasMany
    {
        return $this->hasMany(EngineeringBranchLock::class);
    }

    public function runtimeMetrics(): HasMany
    {
        return $this->hasMany(EngineeringWorkerRuntime::class)->latest('recorded_at');
    }

    // Helpers

    public function isAvailable(): bool
    {
        return $this->status->isAvailable();
    }

    public function isHealthy(): bool
    {
        return $this->status->isActive() && $this->last_heartbeat_at?->diffInMinutes(now()) < 5;
    }

    public function markHeartbeat(): void
    {
        $this->update(['last_heartbeat_at' => now()]);
    }
}
