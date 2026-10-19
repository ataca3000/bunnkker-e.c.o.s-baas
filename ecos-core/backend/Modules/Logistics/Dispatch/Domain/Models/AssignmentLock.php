<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Modules\Logistics\Dispatch\Domain\Enums\LockStatus;

/**
 * A short-lived hold on a vehicle, driver or trip.
 *
 * ┌─ THE MUTUAL-EXCLUSION INVARIANT ────────────────────────────────────────┐
 * │ One LIVE lock per resource, enforced by a unique index on               │
 * │ (resource_type, resource_id, active_flag) — not by application care.    │
 * │ Two dispatchers must not both believe they hold the same van, and a     │
 * │ read-modify-write check would lose that race under real concurrency.    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Every lock EXPIRES. A dispatcher who closes their laptop must not hold a
 * vehicle hostage until someone notices.
 */
class AssignmentLock extends Model
{
    public const RESOURCE_VEHICLE = 'vehicle';

    public const RESOURCE_DRIVER = 'driver';

    public const RESOURCE_TRIP = 'trip';

    /** Long enough for a dispatcher to think, short enough to self-heal. */
    public const DEFAULT_TTL_MINUTES = 15;

    protected $table = 'dispatch_assignment_locks';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => LockStatus::Held->value,
        'active_flag' => 1,
    ];

    protected $fillable = [
        'uuid', 'company_id', 'dispatch_session_id',
        'resource_type', 'resource_id', 'status',
        'acquired_at', 'expires_at', 'released_at', 'release_reason',
        'held_by', 'held_by_name', 'active_flag',
    ];

    protected function casts(): array
    {
        return [
            'status' => LockStatus::class,
            'acquired_at' => 'datetime',
            'expires_at' => 'datetime',
            'released_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $lock): void {
            if ($lock->uuid === null) {
                $lock->uuid = (string) Str::uuid();
            }

            if ($lock->acquired_at === null) {
                $lock->acquired_at = now();
            }

            if ($lock->expires_at === null) {
                $lock->expires_at = now()->addMinutes(self::DEFAULT_TTL_MINUTES);
            }
        });
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(DispatchSession::class, 'dispatch_session_id');
    }

    public function isHeld(): bool
    {
        return $this->status->isHeld();
    }

    public function hasExpired(?Carbon $at = null): bool
    {
        return $this->isHeld() && ($at ?? Carbon::now())->gt($this->expires_at);
    }

    /** Held AND still within its TTL — the only state that actually blocks. */
    public function isEffective(?Carbon $at = null): bool
    {
        return $this->isHeld() && ! $this->hasExpired($at);
    }

    public function remainingSeconds(?Carbon $at = null): int
    {
        if (! $this->isHeld()) {
            return 0;
        }

        return max(0, (int) ($at ?? Carbon::now())->diffInSeconds($this->expires_at, false));
    }

    public function describeResource(): string
    {
        return ucfirst($this->resource_type).' #'.$this->resource_id;
    }
}
