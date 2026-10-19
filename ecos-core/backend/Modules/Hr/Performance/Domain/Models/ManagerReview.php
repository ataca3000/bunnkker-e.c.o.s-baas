<?php

declare(strict_types=1);

namespace Modules\Hr\Performance\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Hr\Workforce\Domain\Models\Employee;

/** A manager's short written view of a month. Four fields, by design. */
class ManagerReview extends Model
{
    use HasUuids;

    protected $table = 'hr_manager_reviews';

    protected $fillable = [
        'company_id', 'employee_id', 'reviewer_employee_id', 'period_month',
        'overall_rating', 'strengths', 'improvement_notes', 'manager_comments',
        'status', 'submitted_at', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'overall_rating' => 'integer',
            'submitted_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'reviewer_employee_id');
    }

    public function isSubmitted(): bool
    {
        return $this->status === 'submitted';
    }
}
