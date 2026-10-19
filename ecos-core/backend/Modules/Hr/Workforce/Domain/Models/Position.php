<?php

declare(strict_types=1);

namespace Modules\Hr\Workforce\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/** A job definition inside a department, at a job grade. */
class Position extends Model
{
    use HasUuids;
    use SoftDeletes;

    protected $table = 'hr_positions';

    protected $fillable = [
        'company_id', 'department_id', 'job_grade_id',
        'code', 'title', 'description', 'headcount_limit', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'headcount_limit' => 'integer',
        ];
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    public function jobGrade(): BelongsTo
    {
        return $this->belongsTo(JobGrade::class, 'job_grade_id');
    }

    public function employees(): HasMany
    {
        return $this->hasMany(Employee::class, 'position_id');
    }

    /** How many employed people currently hold this position. */
    public function filledHeadcount(): int
    {
        return $this->employees()
            ->whereNotIn('status', ['terminated', 'resigned'])
            ->count();
    }

    public function hasVacancy(): bool
    {
        return $this->headcount_limit === null || $this->filledHeadcount() < (int) $this->headcount_limit;
    }
}
