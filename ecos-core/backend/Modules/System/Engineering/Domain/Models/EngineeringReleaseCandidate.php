<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\System\Engineering\Domain\Enums\ReleaseCandidateStatus;

final class EngineeringReleaseCandidate extends Model
{
    use HasFactory;
    use HasUuids;
    use SoftDeletes;

    protected $table = 'engineering_release_candidates';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'company_id',
        'title',
        'description',
        'status',
        'version_tag',
        'created_by_id',
        'reviewed_by_id',
        'review_started_at',
        'approved_at',
        'rejected_at',
        'staged_at',
        'released_at',
        'rolled_back_at',
        'rejection_reason',
        'metadata',
        'version',
    ];

    protected function casts(): array
    {
        return [
            'status'            => ReleaseCandidateStatus::class,
            'review_started_at' => 'datetime',
            'approved_at'       => 'datetime',
            'rejected_at'       => 'datetime',
            'staged_at'         => 'datetime',
            'released_at'       => 'datetime',
            'rolled_back_at'    => 'datetime',
            'metadata'          => 'array',
            'version'           => 'integer',
        ];
    }

    public function tasks(): BelongsToMany
    {
        return $this->belongsToMany(
            EngineeringTask::class,
            'engineering_release_candidate_tasks',
            'release_candidate_id',
            'task_id',
        )
            ->withPivot('position')
            ->orderByPivot('position');
    }

    public function getTaskCountAttribute(): int
    {
        return $this->tasks()->count();
    }
}
