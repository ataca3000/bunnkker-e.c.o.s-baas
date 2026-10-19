<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** An applicant carrying a tag, and who put it there. */
class ApplicantTagAssignment extends Model
{
    use HasUuids;

    protected $table = 'hr_applicant_tag_assignments';

    protected $fillable = [
        'company_id', 'applicant_id', 'tag_id', 'note', 'assigned_by', 'assigned_at',
    ];

    protected function casts(): array
    {
        return ['assigned_at' => 'datetime'];
    }

    public function tag(): BelongsTo
    {
        return $this->belongsTo(ApplicantTag::class, 'tag_id');
    }

    public function applicant(): BelongsTo
    {
        return $this->belongsTo(Applicant::class, 'applicant_id');
    }
}
