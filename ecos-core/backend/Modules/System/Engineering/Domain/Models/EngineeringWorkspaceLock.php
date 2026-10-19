<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class EngineeringWorkspaceLock extends Model
{
    use HasFactory;
    use HasUuids;

    protected $table = 'engineering_workspace_locks';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'company_id',
        'workspace_path',
        'worker_id',
        'task_id',
        'expires_at',
        'acquired_at',
        'lock_reason',
    ];

    protected $casts = [
        'expires_at'  => 'datetime',
        'acquired_at' => 'datetime',
    ];

    public function worker(): BelongsTo
    {
        return $this->belongsTo(EngineeringWorker::class, 'worker_id');
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(EngineeringTask::class, 'task_id');
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }
}
