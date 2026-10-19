<?php

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\System\Engineering\Domain\Enums\GuardianDecision;
use Modules\System\Engineering\Domain\Enums\GuardianRunStatus;

class GuardianRun extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'engineering_guardian_runs';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'company_id',
        'trigger_source',
        'commit_ref',
        'branch',
        'initiated_by',
        'status',
        'decision',
        'changed_files',
        'diff_stats',
        'total_checks',
        'failed_checks_count',
        'repair_session_id',
        'validation_id',
        'policy_id',
        'pipeline_run_id',
        'decision_reason',
        'started_at',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'status'              => GuardianRunStatus::class,
            'decision'            => GuardianDecision::class,
            'changed_files'       => 'array',
            'diff_stats'          => 'array',
            'total_checks'        => 'integer',
            'failed_checks_count' => 'integer',
            'started_at'          => 'datetime',
            'completed_at'        => 'datetime',
        ];
    }

    // Relations

    public function checks(): HasMany
    {
        return $this->hasMany(GuardianCheck::class, 'run_id');
    }

    public function report(): HasOne
    {
        return $this->hasOne(GuardianReport::class, 'run_id');
    }

    public function decisions(): HasMany
    {
        return $this->hasMany(GuardianDecisionLog::class, 'run_id')
            ->orderBy('occurred_at', 'asc');
    }

    public function repairSession(): BelongsTo
    {
        return $this->belongsTo(RepairSession::class, 'repair_session_id');
    }

    public function validation(): BelongsTo
    {
        return $this->belongsTo(PatchValidation::class, 'validation_id');
    }

    public function policy(): BelongsTo
    {
        return $this->belongsTo(GuardianPolicy::class, 'policy_id');
    }

    // Methods

    public function isTerminal(): bool
    {
        return $this->status->isTerminal();
    }
}
