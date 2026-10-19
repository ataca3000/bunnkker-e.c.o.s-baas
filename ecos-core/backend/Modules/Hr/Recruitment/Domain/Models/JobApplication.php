<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Hr\Recruitment\Domain\Enums\ApplicationStatus;

/** One person's candidacy for one opening. */
class JobApplication extends Model
{
    use HasUuids;

    protected $table = 'hr_job_applications';

    protected $fillable = [
        'company_id', 'job_opening_id', 'applicant_id', 'current_stage_id', 'application_number',
        'years_experience', 'current_employer', 'previous_employer', 'expected_salary', 'currency',
        'available_from', 'additional_notes', 'status', 'source', 'applied_at',
        'decided_at', 'decided_by', 'decision_reason', 'match_score', 'match_explanation',
        // HR V1 enhancements — the recruiter who owns this candidacy, and parking
        // it without judging it. Archiving is not rejecting.
        'recruiter_employee_id', 'archived_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => ApplicationStatus::class,
            'years_experience' => 'decimal:2',
            'expected_salary' => 'decimal:2',
            'available_from' => 'date',
            'applied_at' => 'datetime',
            'decided_at' => 'datetime',
            'archived_at' => 'datetime',
            'match_score' => 'integer',
            'match_explanation' => 'array',
        ];
    }

    public function applicant(): BelongsTo
    {
        return $this->belongsTo(Applicant::class, 'applicant_id');
    }

    public function jobOpening(): BelongsTo
    {
        return $this->belongsTo(JobOpening::class, 'job_opening_id');
    }

    public function currentStage(): BelongsTo
    {
        return $this->belongsTo(RecruitmentStage::class, 'current_stage_id');
    }

    public function stageEvents(): HasMany
    {
        return $this->hasMany(ApplicationStageEvent::class, 'application_id')->orderBy('occurred_at');
    }

    public function evaluations(): HasMany
    {
        return $this->hasMany(ApplicationEvaluation::class, 'application_id')->orderByDesc('evaluated_at');
    }

    public function interviews(): HasMany
    {
        return $this->hasMany(Interview::class, 'application_id')->orderBy('scheduled_at');
    }

    public function canBeHired(): bool
    {
        return $this->status->canBeHired();
    }

    /** The average of every score recorded against this candidacy. */
    public function averageScore(): ?float
    {
        $scores = $this->evaluations()->whereNotNull('score')->pluck('score');

        return $scores->isEmpty() ? null : round((float) $scores->avg(), 1);
    }
}
