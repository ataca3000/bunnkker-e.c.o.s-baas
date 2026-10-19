<?php

declare(strict_types=1);

namespace Modules\Hr\Workforce\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A rung on the seniority ladder. Carries a level for ordering, never a pay band. */
class JobGrade extends Model
{
    use HasUuids;

    protected $table = 'hr_job_grades';

    protected $fillable = ['company_id', 'code', 'name', 'level', 'description', 'is_active'];

    protected function casts(): array
    {
        return ['level' => 'integer', 'is_active' => 'boolean'];
    }

    public function positions(): HasMany
    {
        return $this->hasMany(Position::class, 'job_grade_id');
    }
}
