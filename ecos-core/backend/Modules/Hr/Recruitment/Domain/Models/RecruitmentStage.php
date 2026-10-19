<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/** One configurable step of the recruitment pipeline. */
class RecruitmentStage extends Model
{
    use HasUuids;

    protected $table = 'hr_recruitment_stages';

    protected $fillable = [
        'company_id', 'code', 'name', 'description', 'sequence',
        'type', 'is_initial', 'is_terminal', 'is_active', 'color',
    ];

    protected function casts(): array
    {
        return [
            'sequence' => 'integer',
            'is_initial' => 'boolean',
            'is_terminal' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true)->orderBy('sequence');
    }

    /** Whether this stage is the kind that expects an interview to be scheduled. */
    public function expectsInterview(): bool
    {
        return $this->type === 'interview';
    }
}
