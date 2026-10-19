<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\System\Engineering\Domain\Enums\{QueueStatus, SchedulingPolicy};

final class EngineeringExecutionQueue extends Model
{
    use HasFactory;
    use HasUuids;

    protected $table = 'engineering_execution_queue';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'company_id',
        'task_id',
        'priority',
        'status',
        'scheduling_policy',
        'assigned_worker_id',
        'reserved_worker_id',
        'earliest_start_at',
        'enqueued_at',
        'assigned_at',
        'started_at',
        'completed_at',
        'cancelled_at',
        'expires_at',
        'retry_count',
        'max_retries',
        'cancellation_reason',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'status'            => QueueStatus::class,
            'scheduling_policy' => SchedulingPolicy::class,
            'priority'          => 'integer',
            'retry_count'       => 'integer',
            'max_retries'       => 'integer',
            'earliest_start_at' => 'datetime',
            'enqueued_at'       => 'datetime',
            'assigned_at'       => 'datetime',
            'started_at'        => 'datetime',
            'completed_at'      => 'datetime',
            'cancelled_at'      => 'datetime',
            'expires_at'        => 'datetime',
            'metadata'          => 'array',
        ];
    }

    // Relations

    public function task(): BelongsTo
    {
        return $this->belongsTo(EngineeringTask::class);
    }

    public function assignedWorker(): BelongsTo
    {
        return $this->belongsTo(EngineeringWorker::class, 'assigned_worker_id');
    }

    public function reservedWorker(): BelongsTo
    {
        return $this->belongsTo(EngineeringWorker::class, 'reserved_worker_id');
    }

    // Helpers

    public function isTerminal(): bool
    {
        return $this->status->isTerminal();
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    public function getQueueWaitSecondsAttribute(): ?int
    {
        return $this->assigned_at ? (int) $this->enqueued_at->diffInSeconds($this->assigned_at) : null;
    }
}
