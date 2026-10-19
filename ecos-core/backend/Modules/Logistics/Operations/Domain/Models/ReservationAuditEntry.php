<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * Append-only record of what happened to a reservation.
 *
 * Capacity disputes — "who took the last twenty orders in Nasr City?" — are
 * settled from this table. A row that can be edited afterwards settles nothing,
 * so updates and deletes are refused at the model.
 */
class ReservationAuditEntry extends Model
{
    public const ACTION_REQUESTED = 'requested';

    public const ACTION_HELD = 'held';

    public const ACTION_CONFIRMED = 'confirmed';

    public const ACTION_RELEASED = 'released';

    public const ACTION_EXPIRED = 'expired';

    public const ACTION_FAILED = 'failed';

    public const ACTION_REBALANCED = 'rebalanced';

    protected $table = 'ops_reservation_audit_entries';

    protected $fillable = [
        'uuid', 'company_id', 'capacity_reservation_id',
        'action', 'outcome', 'reason', 'context',
        'performed_at', 'actor_id', 'actor_name',
    ];

    protected function casts(): array
    {
        return [
            'context' => 'array',
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

        // Append-only, enforced here rather than by convention.
        static::updating(static fn () => false);
        static::deleting(static fn () => false);
    }

    public function reservation(): BelongsTo
    {
        return $this->belongsTo(CapacityReservation::class, 'capacity_reservation_id');
    }
}
