<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One logged move through the pipeline — append-only.
 *
 * "Why was this candidate rejected after the second interview" is a question the
 * pipeline must answer months later, and only a log can answer it.
 */
class ApplicationStageEvent extends Model
{
    use HasUuids;

    protected $table = 'hr_application_stage_events';

    protected $fillable = [
        'company_id', 'application_id', 'from_stage_id', 'to_stage_id',
        'action', 'from_status', 'to_status', 'note', 'actor_id', 'occurred_at',
    ];

    protected function casts(): array
    {
        return ['occurred_at' => 'datetime'];
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(JobApplication::class, 'application_id');
    }

    public function fromStage(): BelongsTo
    {
        return $this->belongsTo(RecruitmentStage::class, 'from_stage_id');
    }

    public function toStage(): BelongsTo
    {
        return $this->belongsTo(RecruitmentStage::class, 'to_stage_id');
    }

    /** The history is never rewritten. */
    protected static function booted(): void
    {
        static::updating(fn () => false);
        static::deleting(fn () => false);
    }
}
