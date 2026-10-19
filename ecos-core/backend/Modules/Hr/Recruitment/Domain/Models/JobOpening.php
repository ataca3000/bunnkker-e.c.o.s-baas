<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Modules\Hr\Recruitment\Domain\Enums\JobOpeningStatus;
use Modules\Hr\Workforce\Domain\Models\Department;
use Modules\Hr\Workforce\Domain\Models\EmploymentType;
use Modules\Hr\Workforce\Domain\Models\Position;

/** A job the company is hiring for — and the only HR record with a public face. */
class JobOpening extends Model
{
    use HasUuids;
    use SoftDeletes;

    protected $table = 'hr_job_openings';

    protected $fillable = [
        'company_id', 'department_id', 'branch_id', 'position_id', 'employment_type_id', 'job_grade_id',
        'reference', 'slug', 'title', 'description', 'requirements', 'responsibilities',
        'work_location', 'work_mode', 'salary_min', 'salary_max', 'currency', 'show_salary',
        'openings_count', 'filled_count', 'status', 'is_public', 'published_at', 'closes_on',
        'closed_at', 'hiring_manager_employee_id', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => JobOpeningStatus::class,
            'salary_min' => 'decimal:2',
            'salary_max' => 'decimal:2',
            'show_salary' => 'boolean',
            'is_public' => 'boolean',
            'openings_count' => 'integer',
            'filled_count' => 'integer',
            'published_at' => 'datetime',
            'closes_on' => 'date',
            'closed_at' => 'datetime',
        ];
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    public function position(): BelongsTo
    {
        return $this->belongsTo(Position::class, 'position_id');
    }

    public function employmentType(): BelongsTo
    {
        return $this->belongsTo(EmploymentType::class, 'employment_type_id');
    }

    public function applications(): HasMany
    {
        return $this->hasMany(JobApplication::class, 'job_opening_id');
    }

    /**
     * The only query the public portal may run.
     *
     * Published, flagged public, and not past its closing date — three conditions
     * that must all hold, expressed once so no endpoint can forget one.
     */
    public function scopePubliclyVisible(Builder $query): Builder
    {
        return $query->where('status', JobOpeningStatus::Published->value)
            ->where('is_public', true)
            ->where(function ($q): void {
                $q->whereNull('closes_on')->orWhere('closes_on', '>=', Carbon::now()->toDateString());
            });
    }

    public function isOpenForApplications(): bool
    {
        if (! $this->status->acceptsApplications() || ! $this->is_public) {
            return false;
        }

        if ($this->closes_on !== null && $this->closes_on->lessThan(Carbon::now()->startOfDay())) {
            return false;
        }

        return $this->remainingPositions() > 0;
    }

    public function remainingPositions(): int
    {
        return max(0, (int) $this->openings_count - (int) $this->filled_count);
    }
}
