<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Modules\Logistics\Dispatch\Domain\Enums\QueueItemStatus;
use Modules\Logistics\Dispatch\Domain\Enums\QueuePriority;
use Modules\Logistics\Distribution\Domain\Models\Trip;

/**
 * A trip waiting for resources.
 *
 * `rank` is DERIVED from priority plus waiting time and recomputed by the queue
 * service — never supplied by a caller. If callers could set it, every
 * integration would mark its own trips urgent and the ordering would stop
 * meaning anything.
 */
class DispatchQueueItem extends Model
{
    protected $table = 'dispatch_queue_items';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => QueueItemStatus::Waiting->value,
        'priority' => QueuePriority::Normal->value,
        'rank' => 1000,
        'attempt_count' => 0,
        'active_flag' => 1,
    ];

    protected $fillable = [
        'uuid', 'dispatch_board_id', 'company_id', 'trip_id',
        'status', 'priority', 'rank', 'priority_reason',
        'queued_at', 'claimed_at', 'completed_at', 'claimed_by_session_id',
        'attempt_count', 'last_failure_reason', 'active_flag',
    ];

    protected function casts(): array
    {
        return [
            'status' => QueueItemStatus::class,
            'priority' => QueuePriority::class,
            'rank' => 'integer',
            'attempt_count' => 'integer',
            'queued_at' => 'datetime',
            'claimed_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $item): void {
            if ($item->uuid === null) {
                $item->uuid = (string) Str::uuid();
            }

            if ($item->queued_at === null) {
                $item->queued_at = now();
            }
        });
    }

    public function board(): BelongsTo
    {
        return $this->belongsTo(DispatchBoard::class, 'dispatch_board_id');
    }

    /** Distribution owns the trip. Read-only from Dispatch. */
    public function trip(): BelongsTo
    {
        return $this->belongsTo(Trip::class, 'trip_id');
    }

    public function claimedBy(): BelongsTo
    {
        return $this->belongsTo(DispatchSession::class, 'claimed_by_session_id');
    }

    public function needsAction(): bool
    {
        return $this->status->needsAction();
    }

    public function isLive(): bool
    {
        return $this->status->isLive();
    }

    public function waitingMinutes(?Carbon $at = null): int
    {
        return (int) $this->queued_at->diffInMinutes($at ?? Carbon::now());
    }

    /**
     * Rank with ageing applied. Lower sorts first.
     *
     * Ageing prevents starvation: a Low item that has waited two hours should
     * eventually overtake a Normal one that just arrived, or the bottom of the
     * queue never moves. Clamped at zero so ageing can never leapfrog Critical.
     */
    public function computeRank(?Carbon $at = null): int
    {
        $base = $this->priority->baseRank();
        $aged = $base - ($this->waitingMinutes($at) * $this->priority->ageWeight());

        return max($this->priority === QueuePriority::Critical ? 0 : 1, $aged);
    }

    /** An item that keeps failing needs a human, not another retry. */
    public function isStuck(int $threshold = 3): bool
    {
        return $this->attempt_count >= $threshold;
    }
}
