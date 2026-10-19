<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Hr\Recruitment\Domain\Enums\EvaluationRating;
use Modules\Hr\Workforce\Domain\Models\Employee;

/** A reviewer's judgement of a candidate at a point in the pipeline. */
class ApplicationEvaluation extends Model
{
    use HasUuids;

    protected $table = 'hr_application_evaluations';

    protected $fillable = [
        'company_id', 'application_id', 'stage_id', 'reviewer_employee_id',
        'rating', 'score', 'comments', 'evaluated_at', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'rating' => EvaluationRating::class,
            'score' => 'integer',
            'evaluated_at' => 'datetime',
        ];
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(JobApplication::class, 'application_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'reviewer_employee_id');
    }

    /** The score actually recorded, or the one the rating stands for. */
    public function effectiveScore(): int
    {
        return $this->score ?? $this->rating->defaultScore();
    }
}
