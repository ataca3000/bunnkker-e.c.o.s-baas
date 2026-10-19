<?php

declare(strict_types=1);

namespace Modules\Logistics\Network\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Modules\Logistics\Network\Domain\Enums\CapacityCommitmentStatus;

/**
 * A hold against a slot.
 *
 * reference_type/reference_id are deliberately free-form strings: Network must
 * not depend on Orders' schema, and an FK here would couple the two contexts in
 * exactly the direction the architecture forbids.
 */
class CapacityCommitment extends Model
{
    protected $table = 'network_capacity_commitments';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => CapacityCommitmentStatus::Reserved->value,
        'orders' => 0,
        'stops' => 0,
        'weight_kg' => 0,
        'volume_m3' => 0,
    ];

    protected $fillable = [
        'uuid', 'capacity_slot_id', 'company_id', 'status',
        'reference_type', 'reference_id',
        'orders', 'stops', 'weight_kg', 'volume_m3',
        'expires_at', 'committed_at', 'released_at', 'release_reason', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => CapacityCommitmentStatus::class,
            'orders' => 'integer',
            'stops' => 'integer',
            'weight_kg' => 'decimal:2',
            'volume_m3' => 'decimal:3',
            'expires_at' => 'datetime',
            'committed_at' => 'datetime',
            'released_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $commitment): void {
            if ($commitment->uuid === null) {
                $commitment->uuid = (string) Str::uuid();
            }
        });
    }

    public function slot(): BelongsTo
    {
        return $this->belongsTo(CapacitySlot::class, 'capacity_slot_id');
    }

    public function holdsCapacity(): bool
    {
        return $this->status->holdsCapacity();
    }

    /** A soft hold past its TTL. The sweep reclaims these. */
    public function hasExpired(?Carbon $at = null): bool
    {
        return $this->status->isReclaimable()
            && $this->expires_at !== null
            && ($at ?? Carbon::now())->gt($this->expires_at);
    }

    /** @return array<string, float> */
    public function quantities(): array
    {
        return [
            'orders' => (float) $this->orders,
            'stops' => (float) $this->stops,
            'weight_kg' => (float) $this->weight_kg,
            'volume_m3' => (float) $this->volume_m3,
        ];
    }
}
