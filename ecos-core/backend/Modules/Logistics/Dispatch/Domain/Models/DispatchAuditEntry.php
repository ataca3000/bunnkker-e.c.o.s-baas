<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * APPEND-ONLY audit of consequential dispatch actions.
 *
 * Answers "who did what, when, and why" — precisely the question that cannot be
 * answered after a bad morning without a record like this.
 *
 * `changes` deliberately holds only the fields that MOVED. A full row snapshot
 * would balloon and obscure what actually changed, which defeats the purpose.
 */
class DispatchAuditEntry extends Model
{
    public const ACTION_SESSION_OPENED = 'session.opened';

    public const ACTION_SESSION_CLOSED = 'session.closed';

    public const ACTION_ASSIGNED_MANUAL = 'assignment.manual';

    public const ACTION_ASSIGNED_AUTOMATIC = 'assignment.automatic';

    public const ACTION_OVERRIDDEN = 'assignment.overridden';

    public const ACTION_REVIEW_APPROVED = 'review.approved';

    public const ACTION_REVIEW_REJECTED = 'review.rejected';

    public const ACTION_CONFLICT_OVERRIDDEN = 'conflict.overridden';

    public const ACTION_CONFLICT_RESOLVED = 'conflict.resolved';

    public const ACTION_LOCK_BROKEN = 'lock.broken';

    public const ACTION_RELEASED = 'assignment.released';

    /** Actions that may never be recorded without a reason. */
    public const REASON_REQUIRED = [
        self::ACTION_OVERRIDDEN,
        self::ACTION_REVIEW_REJECTED,
        self::ACTION_CONFLICT_OVERRIDDEN,
        self::ACTION_LOCK_BROKEN,
    ];

    protected $table = 'dispatch_audit_entries';

    protected $fillable = [
        'uuid', 'company_id', 'assignment_id', 'dispatch_session_id',
        'action', 'entity_type', 'entity_id', 'changes', 'reason',
        'performed_at', 'actor_id', 'actor_name', 'ip_address',
    ];

    protected function casts(): array
    {
        return [
            'changes' => 'array',
            'performed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $entry): void {
            if ($entry->uuid === null) {
                $entry->uuid = (string) Str::uuid();
            }

            if ($entry->performed_at === null) {
                $entry->performed_at = now();
            }
        });

        // Append-only: an audit trail that can be edited is not an audit trail.
        static::updating(static fn () => false);
        static::deleting(static fn () => false);
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(DispatchProposedAssignment::class, 'assignment_id');
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(DispatchSession::class, 'dispatch_session_id');
    }

    public static function actionRequiresReason(string $action): bool
    {
        return in_array($action, self::REASON_REQUIRED, true);
    }

    /** An override or a forced action — the entries a supervisor looks for. */
    public function isOverride(): bool
    {
        return in_array($this->action, [
            self::ACTION_OVERRIDDEN,
            self::ACTION_CONFLICT_OVERRIDDEN,
            self::ACTION_LOCK_BROKEN,
        ], true);
    }
}
