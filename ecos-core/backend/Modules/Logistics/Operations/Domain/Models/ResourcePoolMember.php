<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;
use Modules\Logistics\Operations\Domain\Enums\PoolMemberStatus;
use Modules\Logistics\Operations\Domain\Enums\PoolMemberType;

/**
 * One resource's membership of one pool.
 *
 * The row carries an id and a status. It deliberately carries no plate number,
 * no name and no readiness — a copy of any of those would be a second version of
 * the truth that drifts the moment the owning module changes it.
 */
class ResourcePoolMember extends Model
{
    protected $table = 'ops_resource_pool_members';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => PoolMemberStatus::Active->value,
    ];

    protected $fillable = [
        'uuid', 'resource_pool_id', 'member_type', 'member_id',
        'status', 'status_reason', 'membership_reason',
        'joined_at', 'left_at', 'active_flag', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'member_type' => PoolMemberType::class,
            'status' => PoolMemberStatus::class,
            'member_id' => 'integer',
            'joined_at' => 'datetime',
            'left_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $member): void {
            if ($member->uuid === null) {
                $member->uuid = (string) Str::uuid();
            }

            if ($member->joined_at === null) {
                $member->joined_at = now();
            }
        });
    }

    public function pool(): BelongsTo
    {
        return $this->belongsTo(ResourcePool::class, 'resource_pool_id');
    }

    public function isLive(): bool
    {
        return $this->status->isLive();
    }

    /** Who decides whether this resource can work — never this module. */
    public function readinessAuthority(): string
    {
        return $this->member_type->readinessAuthority();
    }
}
