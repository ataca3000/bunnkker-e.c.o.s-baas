<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Modules\Logistics\Dispatch\Domain\Enums\DispatchSessionStatus;
use Modules\Logistics\Dispatch\Domain\Enums\LockStatus;

/**
 * A dispatcher's working window over a board.
 *
 * Sessions exist because batch dispatch, locks and the audit trail all need
 * something to attribute work to. "Who was dispatching when this happened" is
 * unanswerable without one, and that question is exactly what gets asked when a
 * morning goes wrong.
 */
class DispatchSession extends Model
{
    public const MODE_MANUAL = 'manual';

    public const MODE_AUTOMATIC = 'automatic';

    public const MODE_HYBRID = 'hybrid';

    /** A session with no activity for this long is abandoned by the sweep. */
    public const IDLE_TIMEOUT_MINUTES = 120;

    protected $table = 'dispatch_sessions';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => DispatchSessionStatus::Open->value,
        'mode' => self::MODE_MANUAL,
        'assigned_count' => 0,
        'released_count' => 0,
        'conflict_count' => 0,
    ];

    protected $fillable = [
        'uuid', 'company_id', 'dispatch_board_id', 'status', 'mode',
        'started_at', 'ended_at', 'operator_id', 'operator_name',
        'assigned_count', 'released_count', 'conflict_count',
        'notes', 'close_reason',
    ];

    protected function casts(): array
    {
        return [
            'status' => DispatchSessionStatus::class,
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'assigned_count' => 'integer',
            'released_count' => 'integer',
            'conflict_count' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $session): void {
            if ($session->uuid === null) {
                $session->uuid = (string) Str::uuid();
            }

            if ($session->started_at === null) {
                $session->started_at = now();
            }
        });
    }

    public function board(): BelongsTo
    {
        return $this->belongsTo(DispatchBoard::class, 'dispatch_board_id');
    }

    public function locks(): HasMany
    {
        return $this->hasMany(AssignmentLock::class, 'dispatch_session_id');
    }

    public function heldLocks(): HasMany
    {
        return $this->locks()->where('status', LockStatus::Held->value);
    }

    public function queueItems(): HasMany
    {
        return $this->hasMany(DispatchQueueItem::class, 'claimed_by_session_id');
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(ResourceAllocation::class, 'dispatch_session_id');
    }

    public function conflicts(): HasMany
    {
        return $this->hasMany(DispatchConflict::class, 'dispatch_session_id');
    }

    public function timelineEvents(): HasMany
    {
        return $this->hasMany(DispatchTimelineEvent::class, 'dispatch_session_id')
            ->orderByDesc('occurred_at');
    }

    public function isActive(): bool
    {
        return $this->status->isActive();
    }

    public function isAutomatic(): bool
    {
        return $this->mode === self::MODE_AUTOMATIC;
    }

    public function durationMinutes(): ?int
    {
        if ($this->started_at === null) {
            return null;
        }

        return (int) $this->started_at->diffInMinutes($this->ended_at ?? Carbon::now());
    }

    /**
     * Has this session gone quiet? A dispatcher who walked away still holds
     * locks, so idleness is a resource problem, not just an accounting one.
     */
    public function isIdle(?Carbon $at = null): bool
    {
        if (! $this->isActive()) {
            return false;
        }

        $lastTouch = $this->updated_at ?? $this->started_at;

        return $lastTouch !== null
            && $lastTouch->lt(($at ?? Carbon::now())->subMinutes(self::IDLE_TIMEOUT_MINUTES));
    }

    /** Throughput — assignments per hour, for the KPI surface. */
    public function throughputPerHour(): ?float
    {
        $minutes = $this->durationMinutes();

        if ($minutes === null || $minutes < 1) {
            return null;
        }

        return round(($this->assigned_count / $minutes) * 60, 2);
    }
}
