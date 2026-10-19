<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** One tag in a company's catalogue. */
class ApplicantTag extends Model
{
    use HasUuids;

    protected $table = 'hr_applicant_tags';

    protected $fillable = [
        'company_id', 'key', 'name', 'description', 'color',
        'is_active', 'sequence', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'sequence' => 'integer',
        ];
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(ApplicantTagAssignment::class, 'tag_id');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Retiring a tag deactivates it; it is never deleted while anyone carries it.
     *
     * Deleting would cascade the assignments away, and "why was this candidate
     * marked urgent" would lose its answer along with the tag.
     */
    public function isInUse(): bool
    {
        return $this->assignments()->exists();
    }
}
