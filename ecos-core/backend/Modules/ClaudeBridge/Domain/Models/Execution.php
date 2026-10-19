<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string $id
 * @property string $task_id
 * @property string $worker_id
 * @property int $attempt_number
 * @property \Carbon\Carbon $started_at
 * @property \Carbon\Carbon|null $finished_at
 * @property int|null $exit_code
 * @property int|null $tokens_used
 * @property string|null $claude_version
 * @property string|null $failure_code
 * @property string|null $failure_message
 * @property int|null $duration_seconds
 */
final class Execution extends Model
{
    use HasUuids;

    protected $table = 'cb_executions';

    public $timestamps = false;

    protected $fillable = [
        'task_id',
        'worker_id',
        'attempt_number',
        'started_at',
        'finished_at',
        'exit_code',
        'tokens_used',
        'claude_version',
        'failure_code',
        'failure_message',
        'duration_seconds',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
    ];

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class, 'task_id');
    }

    public function worker(): BelongsTo
    {
        return $this->belongsTo(Worker::class, 'worker_id');
    }

    public function artifacts(): HasMany
    {
        return $this->hasMany(Artifact::class, 'execution_id');
    }
}
