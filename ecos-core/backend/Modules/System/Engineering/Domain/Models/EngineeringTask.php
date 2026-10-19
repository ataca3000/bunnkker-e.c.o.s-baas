<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\System\Engineering\Domain\Enums\TaskPriority;
use Modules\System\Engineering\Domain\Enums\TaskStatus;

final class EngineeringTask extends Model
{
    use HasFactory;
    use HasUuids;
    use SoftDeletes;

    protected $table = 'engineering_tasks';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'title',
        'description',
        'status',
        'priority',
        'source_type',
        'source_ref',
        'company_id',
        'assigned_agent_id',
        'created_by_id',
        'updated_by_id',
        'deadline',
        'queued_at',
        'assigned_at',
        'accepted_at',
        'started_at',
        'paused_at',
        'completed_at',
        'failed_at',
        'cancelled_at',
        'released_at',
        'archived_at',
        'failure_reason',
        'retry_count',
        'max_retries',
        'metadata',
        'version',
    ];

    protected function casts(): array
    {
        return [
            'status'       => TaskStatus::class,
            'priority'     => TaskPriority::class,
            'deadline'     => 'datetime',
            'queued_at'    => 'datetime',
            'assigned_at'  => 'datetime',
            'accepted_at'  => 'datetime',
            'started_at'   => 'datetime',
            'paused_at'    => 'datetime',
            'completed_at' => 'datetime',
            'failed_at'    => 'datetime',
            'cancelled_at' => 'datetime',
            'released_at'  => 'datetime',
            'archived_at'  => 'datetime',
            'retry_count'  => 'integer',
            'max_retries'  => 'integer',
            'version'      => 'integer',
            'metadata'     => 'array',
        ];
    }

    // -------------------------------------------------------------------------
    // Relations
    // -------------------------------------------------------------------------

    public function agent(): BelongsTo
    {
        return $this->belongsTo(EngineeringAgent::class, 'assigned_agent_id');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(EngineeringTaskComment::class);
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(EngineeringTaskAttachment::class);
    }

    public function dependencies(): HasMany
    {
        return $this->hasMany(EngineeringTaskDependency::class);
    }

    public function labels(): BelongsToMany
    {
        return $this->belongsToMany(
            EngineeringTaskLabel::class,
            'engineering_task_label_pivot',
            'task_id',
            'label_id',
        );
    }

    public function history(): HasMany
    {
        return $this->hasMany(EngineeringTaskHistory::class)
            ->orderByDesc('occurred_at');
    }

    public function activity(): HasMany
    {
        return $this->hasMany(EngineeringTaskActivity::class)
            ->orderByDesc('created_at');
    }

    public function watchers(): BelongsToMany
    {
        return $this->belongsToMany(
            \App\Models\User::class,
            'engineering_task_watchers',
            'task_id',
            'user_id',
        );
    }

    public function checklists(): HasMany
    {
        return $this->hasMany(EngineeringTaskChecklist::class)
            ->orderBy('position');
    }

    public function executionSessions(): HasMany
    {
        return $this->hasMany(ExecutionSession::class);
    }

    // -------------------------------------------------------------------------
    // Helper methods
    // -------------------------------------------------------------------------

    public function isTerminal(): bool
    {
        return $this->status->isTerminal();
    }

    public function canTransitionTo(TaskStatus $next): bool
    {
        return $this->status->canTransitionTo($next);
    }

    public function getChecklistProgressAttribute(): array
    {
        $total     = $this->checklists->flatMap->items->count();
        $completed = $this->checklists->flatMap->items->where('is_completed', true)->count();

        return [
            'total'     => $total,
            'completed' => $completed,
            'percent'   => $total > 0 ? round($completed / $total * 100) : 0,
        ];
    }
}
