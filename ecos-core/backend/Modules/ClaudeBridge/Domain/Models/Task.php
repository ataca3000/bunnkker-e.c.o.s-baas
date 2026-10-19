<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Modules\ClaudeBridge\Domain\Enums\TaskPriority;
use Modules\ClaudeBridge\Domain\Enums\TaskStatus;

/**
 * @property string $id
 * @property string $company_id
 * @property string $created_by_user_id
 * @property string $title
 * @property string $description
 * @property string $repository_path
 * @property string $target_branch
 * @property TaskStatus $status
 * @property TaskPriority $priority
 * @property string|null $worker_id
 * @property string|null $failure_reason
 * @property string|null $review_comment
 * @property string|null $reviewed_by
 * @property \Carbon\Carbon|null $reviewed_at
 * @property \Carbon\Carbon|null $cancelled_at
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
final class Task extends Model
{
    use HasUuids;

    protected $table = 'cb_tasks';

    protected $fillable = [
        'company_id',
        'created_by_user_id',
        'title',
        'description',
        'repository_path',
        'target_branch',
        'status',
        'priority',
        'worker_id',
        'failure_reason',
        'review_comment',
        'reviewed_by',
        'reviewed_at',
        'cancelled_at',
    ];

    protected $casts = [
        'status' => TaskStatus::class,
        'priority' => TaskPriority::class,
        'reviewed_at' => 'datetime',
        'cancelled_at' => 'datetime',
    ];

    public function worker(): BelongsTo
    {
        return $this->belongsTo(Worker::class, 'worker_id');
    }

    public function executions(): HasMany
    {
        return $this->hasMany(Execution::class, 'task_id');
    }

    public function latestExecution(): HasOne
    {
        return $this->hasOne(Execution::class, 'task_id')->latestOfMany('attempt_number');
    }

    public function artifacts(): HasMany
    {
        return $this->hasMany(Artifact::class, 'task_id');
    }
}
