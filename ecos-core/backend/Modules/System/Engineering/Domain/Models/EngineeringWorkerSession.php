<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\System\Engineering\Domain\Enums\WorkerSessionStatus;

final class EngineeringWorkerSession extends Model
{
    use HasFactory;
    use HasUuids;

    protected $table = 'engineering_worker_sessions';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'company_id',
        'worker_id',
        'task_id',
        'status',
        'workspace_path',
        'git_branch',
        'git_commit_before',
        'git_commit_after',
        'progress_percent',
        'progress_message',
        'failure_reason',
        'cpu_seconds_used',
        'memory_mb_peak',
        'disk_gb_peak',
        'metadata',
        'started_at',
        'paused_at',
        'resumed_at',
        'completed_at',
        'failed_at',
        'aborted_at',
    ];

    protected function casts(): array
    {
        return [
            'status'           => WorkerSessionStatus::class,
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
    }

    // Relations

    public function worker(): BelongsTo
    {
        return $this->belongsTo(EngineeringWorker::class);
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(EngineeringTask::class);
    }

    // Helpers

    public function isTerminal(): bool
    {
        return $this->status->isTerminal();
    }

    public function getDurationSecondsAttribute(): ?int
    {
        $end = $this->completed_at ?? $this->failed_at ?? $this->aborted_at;

        return ($this->started_at && $end) ? (int) $this->started_at->diffInSeconds($end) : null;
    }
}
