<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Modules\Hr\Recruitment\Domain\Enums\InterviewStatus;
use Modules\Hr\Workforce\Domain\Models\Employee;

/** A scheduled conversation with a candidate, and what came of it. */
class Interview extends Model
{
    use HasUuids;

    protected $table = 'hr_interviews';

    protected $fillable = [
        'company_id', 'application_id', 'stage_id', 'interviewer_employee_id',
        'title', 'scheduled_at', 'duration_minutes', 'mode', 'location', 'panel',
        'status', 'decision', 'notes', 'occurred_at', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => InterviewStatus::class,
            'scheduled_at' => 'datetime',
            'occurred_at' => 'datetime',
            'duration_minutes' => 'integer',
            'panel' => 'array',
        ];
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(JobApplication::class, 'application_id');
    }

    public function interviewer(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'interviewer_employee_id');
    }

    /** Interviews still ahead — what a calendar or a reminder would read. */
    public function scopeUpcoming(Builder $query): Builder
    {
        return $query->where('status', InterviewStatus::Scheduled->value)
            ->where('scheduled_at', '>=', Carbon::now())
            ->orderBy('scheduled_at');
    }
}
