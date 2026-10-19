<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;
use Modules\Logistics\Dispatch\Domain\Enums\ReviewStatus;

/**
 * A human decision on an assignment.
 *
 * Requesting and deciding are separate permissions, and the requester may not
 * approve their own request when the trigger carries risk — the same
 * separation-of-duties rule LOG-005 applied to POD capture vs. validation.
 */
class AssignmentReview extends Model
{
    public const TRIGGER_AUTOMATIC = 'automatic';

    public const TRIGGER_CONFLICT = 'conflict';

    public const TRIGGER_OVERRIDE = 'override';

    public const TRIGGER_POLICY = 'policy';

    public const TRIGGER_MANUAL = 'manual';

    protected $table = 'dispatch_assignment_reviews';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => ReviewStatus::Pending->value,
        'active_flag' => 1,
    ];

    protected $fillable = [
        'uuid', 'company_id', 'assignment_id', 'dispatch_session_id',
        'status', 'trigger', 'trigger_reason',
        'requested_at', 'requested_by',
        'decided_at', 'decided_by', 'decided_by_name', 'decision_reason',
        'active_flag',
    ];

    protected function casts(): array
    {
        return [
            'status' => ReviewStatus::class,
            'requested_at' => 'datetime',
            'decided_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $review): void {
            if ($review->uuid === null) {
                $review->uuid = (string) Str::uuid();
            }

            if ($review->requested_at === null) {
                $review->requested_at = now();
            }
        });
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(DispatchProposedAssignment::class, 'assignment_id');
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(DispatchSession::class, 'dispatch_session_id');
    }

    public function isPending(): bool
    {
        return $this->status === ReviewStatus::Pending;
    }

    public function isApproved(): bool
    {
        return $this->status === ReviewStatus::Approved;
    }

    /**
     * Separation of duties.
     *
     * A conflict or an override review is a risk decision and must be signed
     * off by someone other than the requester. A routine automatic-assignment
     * review may be self-approved — insisting otherwise on every row would
     * simply stall the morning.
     */
    public function canBeDecidedBy(?int $userId): bool
    {
        if (! in_array($this->trigger, [self::TRIGGER_CONFLICT, self::TRIGGER_OVERRIDE], true)) {
            return true;
        }

        return $userId !== null && $userId !== $this->requested_by;
    }

    public function waitingMinutes(): int
    {
        return (int) $this->requested_at->diffInMinutes($this->decided_at ?? now());
    }
}
