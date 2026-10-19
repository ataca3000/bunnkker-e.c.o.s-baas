<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\Hr\Workforce\Domain\Models\Employee;

/**
 * A person the company is considering — never a person it employs.
 *
 * `hired_employee_id` is the single, deliberate bridge to the workforce master,
 * and it is set only when a hire is executed.
 */
class Applicant extends Model
{
    use HasUuids;
    use SoftDeletes;

    protected $table = 'hr_applicants';

    protected $fillable = [
        'company_id', 'applicant_number', 'full_name', 'mobile', 'email', 'birth_date',
        'city', 'country', 'source', 'status', 'notes',
        'in_talent_pool', 'talent_pool_added_at', 'talent_pool_note', 'talent_pool_tags',
        'merged_into_id', 'hired_employee_id', 'hired_at', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'birth_date' => 'date',
            'in_talent_pool' => 'boolean',
            'talent_pool_added_at' => 'datetime',
            'talent_pool_tags' => 'array',
            'hired_at' => 'datetime',
        ];
    }

    public function applications(): HasMany
    {
        return $this->hasMany(JobApplication::class, 'applicant_id');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(ApplicantAttachment::class, 'applicant_id');
    }

    public function hiredEmployee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'hired_employee_id');
    }

    public function mergedInto(): BelongsTo
    {
        return $this->belongsTo(self::class, 'merged_into_id');
    }

    public function isHired(): bool
    {
        return $this->hired_employee_id !== null;
    }

    public function isMerged(): bool
    {
        return $this->merged_into_id !== null;
    }

    /** Records that survived a merge — what every list and search should show. */
    public function scopeCanonical(Builder $query): Builder
    {
        return $query->whereNull('merged_into_id');
    }
}
