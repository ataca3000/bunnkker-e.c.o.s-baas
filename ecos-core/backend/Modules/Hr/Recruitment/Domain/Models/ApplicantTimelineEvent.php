<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Hr\Recruitment\Domain\Enums\TimelineEventType;

/**
 * One line in a candidate's story. Append-only.
 *
 * The model refuses updates and deletes outright rather than trusting callers to
 * behave, because a timeline that can be quietly rewritten is worse than none —
 * it looks authoritative while being wrong.
 */
class ApplicantTimelineEvent extends Model
{
    use HasUuids;

    protected $table = 'hr_applicant_timeline_events';

    protected $fillable = [
        'company_id', 'applicant_id', 'application_id', 'event_type', 'title', 'summary',
        'category', 'subject_type', 'subject_id', 'context',
        'actor_id', 'actor_name', 'is_system', 'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'event_type' => TimelineEventType::class,
            'context' => 'array',
            'is_system' => 'boolean',
            'occurred_at' => 'datetime',
        ];
    }

    public function applicant(): BelongsTo
    {
        return $this->belongsTo(Applicant::class, 'applicant_id');
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(JobApplication::class, 'application_id');
    }

    public function scopeChronological(Builder $query): Builder
    {
        // Two events can share a second — an offer sent and the stage that moved
        // with it. The id breaks the tie so the order never wobbles between reads.
        return $query->orderBy('occurred_at')->orderBy('id');
    }

    public function scopeMostRecentFirst(Builder $query): Builder
    {
        return $query->orderByDesc('occurred_at')->orderByDesc('id');
    }

    /** What happened, as one sentence. */
    public function describe(): string
    {
        return $this->summary !== null && $this->summary !== ''
            ? $this->title.' — '.$this->summary
            : $this->title;
    }

    protected static function booted(): void
    {
        static::updating(fn () => false);
        static::deleting(fn () => false);
    }
}
