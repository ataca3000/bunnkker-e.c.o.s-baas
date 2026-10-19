<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Modules\Logistics\Network\Domain\Models\DispatchRegion;
use Modules\Logistics\Network\Domain\Models\ServiceArea;
use Modules\Logistics\Operations\Domain\Enums\PoolMemberStatus;
use Modules\Logistics\Operations\Domain\Enums\PoolStatus;
use Modules\Logistics\Operations\Domain\Enums\PoolType;

/**
 * A named group of resources an operation draws on.
 *
 * A pool holds MEMBERSHIP only. Ask this model how many vehicles it contains and
 * it will tell you; ask whether any of them can work today and it cannot answer —
 * that is Fleet's and Drivers' judgement, fetched at read time by
 * UnifiedResourcePoolService.
 */
class ResourcePool extends Model
{
    protected $table = 'ops_resource_pools';

    /** @var array<string, mixed> */
    protected $attributes = [
        'pool_type' => PoolType::Mixed->value,
        'status' => PoolStatus::Draft->value,
        'min_assignable' => 0,
    ];

    protected $fillable = [
        'uuid', 'company_id', 'code', 'name', 'description',
        'pool_type', 'status', 'status_reason',
        'dispatch_region_id', 'service_area_id',
        'min_assignable', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'pool_type' => PoolType::class,
            'status' => PoolStatus::class,
            'min_assignable' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $pool): void {
            if ($pool->uuid === null) {
                $pool->uuid = (string) Str::uuid();
            }
        });
    }

    public function members(): HasMany
    {
        return $this->hasMany(ResourcePoolMember::class, 'resource_pool_id');
    }

    /** Members that are currently counted as supply. */
    public function activeMembers(): HasMany
    {
        return $this->members()->where('status', PoolMemberStatus::Active->value);
    }

    public function region(): BelongsTo
    {
        return $this->belongsTo(DispatchRegion::class, 'dispatch_region_id');
    }

    public function serviceArea(): BelongsTo
    {
        return $this->belongsTo(ServiceArea::class, 'service_area_id');
    }

    public function reservations(): HasMany
    {
        return $this->hasMany(CapacityReservation::class, 'resource_pool_id');
    }

    public function isUsable(): bool
    {
        return $this->status->isUsable();
    }

    public function accepts(string $memberType): bool
    {
        return in_array($memberType, $this->pool_type->memberTypes(), true);
    }
}
