<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Domain\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\System\Engineering\Domain\Enums\ReleaseStatus;
use Modules\System\Engineering\Domain\Enums\RiskLevel;
class EngineeringRelease extends Model {
    use HasUuids, SoftDeletes;
    protected $table = 'engineering_releases';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = [
        'company_id','name','version','description','status','release_type',
        'task_ids','task_count','readiness_score','readiness_breakdown',
        'risk_level','risk_factors','is_breaking_change','breaking_changes',
        'target_environment','scheduled_at','collected_at','validated_at',
        'approved_at','rejected_at','pipeline_started_at','released_at',
        'cancelled_at','archived_at','rejection_reason','cancellation_reason',
        'created_by','approved_by','rejected_by','cloned_from_id',
        'pipeline_run_id','pipeline_status','metadata',
    ];
    protected function casts(): array {
        return [
            'status'               => ReleaseStatus::class,
            'risk_level'           => RiskLevel::class,
            'task_ids'             => 'array',
            'readiness_breakdown'  => 'array',
            'risk_factors'         => 'array',
            'breaking_changes'     => 'array',
            'metadata'             => 'array',
            'is_breaking_change'   => 'boolean',
            'scheduled_at'         => 'datetime',
            'collected_at'         => 'datetime',
            'validated_at'         => 'datetime',
            'approved_at'          => 'datetime',
            'rejected_at'          => 'datetime',
            'pipeline_started_at'  => 'datetime',
            'released_at'          => 'datetime',
            'cancelled_at'         => 'datetime',
            'archived_at'          => 'datetime',
        ];
    }
    public function artifacts(): HasMany { return $this->hasMany(EngineeringReleaseArtifact::class, 'release_id'); }
    public function reports(): HasMany { return $this->hasMany(EngineeringReleaseReport::class, 'release_id'); }
    public function validations(): HasMany { return $this->hasMany(EngineeringReleaseValidation::class, 'release_id'); }
    public function approvals(): HasMany { return $this->hasMany(EngineeringReleaseApproval::class, 'release_id'); }
    public function audit(): HasMany { return $this->hasMany(EngineeringReleaseAudit::class, 'release_id'); }
    public function dependencies(): HasMany { return $this->hasMany(EngineeringReleaseDependency::class, 'release_id'); }
    public function packages(): HasMany { return $this->hasMany(EngineeringReleasePackage::class, 'release_id'); }
    public function pipelineRuns(): HasMany { return $this->hasMany(EngineeringReleasePipelineRun::class, 'release_id'); }
    public function risks(): HasMany { return $this->hasMany(EngineeringReleaseRisk::class, 'release_id'); }
    public function notes(): HasMany { return $this->hasMany(EngineeringReleaseNote::class, 'release_id'); }
    public function metrics(): HasMany { return $this->hasMany(EngineeringReleaseMetric::class, 'release_id'); }
    public function isTerminal(): bool { return $this->status->isTerminal(); }
    public function canTransitionTo(ReleaseStatus $next): bool { return $this->status->canTransitionTo($next); }
    public function getTasksAttribute(): \Illuminate\Support\Collection {
        if (empty($this->task_ids)) { return collect(); }
        return EngineeringTask::whereIn('id', $this->task_ids)->get();
    }
    public function getBlockingIssuesAttribute(): \Illuminate\Support\Collection {
        return $this->validations->where('is_blocking', true)->where('passed', false);
    }
}
