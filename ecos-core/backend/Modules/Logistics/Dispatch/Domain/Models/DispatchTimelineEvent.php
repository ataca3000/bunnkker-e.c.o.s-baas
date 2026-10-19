<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The dispatch timeline — what happened on a board, in order.
 *
 * Append-only and operator-facing. Distinct from the audit trail: the timeline
 * is a narrative a dispatcher reads during the morning, the audit is a record a
 * supervisor reads afterwards.
 */
class DispatchTimelineEvent extends Model
{
    public const TYPE_SESSION_OPENED = 'session.opened';

    public const TYPE_SESSION_CLOSED = 'session.closed';

    public const TYPE_QUEUE_BUILT = 'queue.built';

    public const TYPE_ITEM_CLAIMED = 'queue.item_claimed';

    public const TYPE_ASSIGNMENT_MADE = 'assignment.made';

    public const TYPE_ASSIGNMENT_RELEASED = 'assignment.released';

    public const TYPE_ASSIGNMENT_FAILED = 'assignment.failed';

    public const TYPE_CONFLICT_DETECTED = 'conflict.detected';

    public const TYPE_CONFLICT_RESOLVED = 'conflict.resolved';

    public const TYPE_REVIEW_REQUESTED = 'review.requested';

    public const TYPE_REVIEW_DECIDED = 'review.decided';

    public const TYPE_LOCK_BROKEN = 'lock.broken';

    protected $table = 'dispatch_timeline_events';

    /** @var array<string, mixed> */
    protected $attributes = [
        'severity' => 'info',
    ];

    protected $fillable = [
        'company_id', 'dispatch_board_id', 'dispatch_session_id', 'assignment_id',
        'event_type', 'severity', 'title', 'description', 'metadata',
        'occurred_at', 'actor_id', 'actor_name',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'occurred_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $event): void {
            if ($event->occurred_at === null) {
                $event->occurred_at = now();
            }
        });
    }

    public function board(): BelongsTo
    {
        return $this->belongsTo(DispatchBoard::class, 'dispatch_board_id');
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(DispatchSession::class, 'dispatch_session_id');
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(DispatchProposedAssignment::class, 'assignment_id');
    }

    public function isProblem(): bool
    {
        return in_array($this->severity, ['warning', 'critical'], true);
    }
}
