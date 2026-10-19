<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Services;

use Modules\Logistics\Dispatch\Domain\Services\ResourcePoolService;
use Modules\Logistics\Operations\Domain\Enums\PoolMemberStatus;
use Modules\Logistics\Operations\Domain\Enums\PoolMemberType;
use Modules\Logistics\Operations\Domain\Models\ResourcePool;
use Modules\Logistics\Operations\Domain\Models\ResourcePoolMember;

/**
 * Membership joined to readiness — the unified view of what a pool can actually
 * field right now.
 *
 * ┌─ NOTHING HERE DECIDES READINESS ────────────────────────────────────────┐
 * │ Every verdict on every row comes from Dispatch's ResourcePoolService,    │
 * │ which in turn asks Fleet through FleetReadinessQueryInterface and asks   │
 * │ LOG-002 through Driver::canStartDeliveries().                            │
 * │                                                                          │
 * │ Phase 2 already built that composition. Rebuilding it here would be a    │
 * │ second implementation of the same rules, drifting the first time either  │
 * │ authority changed its mind. So it is CALLED, not copied.                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * The join is deliberately one-directional: membership decides WHO is in scope,
 * readiness decides WHETHER each one can work. A member with no readiness row —
 * a vehicle deleted in V1, say — surfaces as unknown rather than silently
 * vanishing, because a pool that quietly shrinks is a pool nobody can trust.
 */
class UnifiedResourcePoolService
{
    public function __construct(
        private readonly ResourcePoolService $dispatchPool,
    ) {}

    /**
     * One pool, every member, each with the owning module's current verdict.
     *
     * @return array<string, mixed>
     */
    public function forPool(ResourcePool $pool): array
    {
        $members = $pool->members()
            ->where('status', '!=', PoolMemberStatus::Withdrawn->value)
            ->get();

        // ONE call, not one per member. Dispatch batches the Fleet lookup
        // internally, so a 500-vehicle pool stays one round trip.
        $readiness = $this->dispatchPool->build($pool->company_id);

        $vehicleIndex = $this->indexBy($readiness['vehicles'], 'vehicle_id');
        $driverIndex = $this->indexBy($readiness['drivers'], 'driver_id');

        $rows = $members->map(function (ResourcePoolMember $member) use ($vehicleIndex, $driverIndex) {
            return $member->member_type === PoolMemberType::Vehicle
                ? $this->vehicleRow($member, $vehicleIndex[$member->member_id] ?? null)
                : $this->driverRow($member, $driverIndex[$member->member_id] ?? null);
        })->values()->all();

        return [
            'pool_id' => $pool->uuid,
            'pool_type' => $pool->pool_type->value,
            'status' => $pool->status->value,
            'members' => $rows,
            'counts' => $this->counts($rows),
        ];
    }

    /**
     * The pool-independent view: everything the company has, whether pooled or
     * not, so a supervisor can see what is sitting outside every pool.
     *
     * @return array<string, mixed>
     */
    public function unassigned(?string $companyId = null): array
    {
        $readiness = $this->dispatchPool->build($companyId);

        $pooledVehicles = $this->pooledIds(PoolMemberType::Vehicle, $companyId);
        $pooledDrivers = $this->pooledIds(PoolMemberType::Driver, $companyId);

        $vehicles = array_values(array_filter(
            $readiness['vehicles'],
            static fn (array $row) => ! in_array((int) $row['vehicle_id'], $pooledVehicles, true),
        ));

        $drivers = array_values(array_filter(
            $readiness['drivers'],
            static fn (array $row) => ! in_array((int) $row['driver_id'], $pooledDrivers, true),
        ));

        return [
            'vehicles' => $vehicles,
            'drivers' => $drivers,
            // An assignable resource in no pool is capacity nobody is planning
            // with — the loss that is invisible in V1.
            'idle_assignable_vehicles' => count(array_filter(
                $vehicles,
                static fn (array $row) => $row['is_assignable'],
            )),
            'idle_available_drivers' => count(array_filter(
                $drivers,
                static fn (array $row) => $row['can_start_deliveries'],
            )),
        ];
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /** @param array<string, mixed>|null $readiness @return array<string, mixed> */
    private function vehicleRow(ResourcePoolMember $member, ?array $readiness): array
    {
        return [
            'membership_id' => $member->uuid,
            'member_type' => PoolMemberType::Vehicle->value,
            'member_id' => $member->member_id,
            'membership_status' => $member->status->value,
            'membership_status_label' => $member->status->label(),
            'membership_reason' => $member->membership_reason,
            'readiness_authority' => $member->readinessAuthority(),

            'label' => $readiness['plate_number'] ?? null,
            'capacity_orders' => $readiness['capacity_orders'] ?? null,
            'fitness' => $readiness['fitness'] ?? null,
            'v1_dispatchable' => $readiness['v1_dispatchable'] ?? null,

            // Two gates, both owned elsewhere, and membership on top of them.
            // A suspended membership makes an otherwise fit vehicle unavailable
            // to THIS pool without saying anything about its roadworthiness.
            'is_available' => $member->status === PoolMemberStatus::Active
                && ($readiness['is_assignable'] ?? false) === true,

            // The resource is gone from V1 but the membership survives. Named,
            // not hidden: a silently shrinking pool is worse than a stale one.
            'is_orphaned' => $readiness === null,
        ];
    }

    /** @param array<string, mixed>|null $readiness @return array<string, mixed> */
    private function driverRow(ResourcePoolMember $member, ?array $readiness): array
    {
        return [
            'membership_id' => $member->uuid,
            'member_type' => PoolMemberType::Driver->value,
            'member_id' => $member->member_id,
            'membership_status' => $member->status->value,
            'membership_status_label' => $member->status->label(),
            'membership_reason' => $member->membership_reason,
            'readiness_authority' => $member->readinessAuthority(),

            'label' => $readiness['full_name'] ?? null,
            'driver_code' => $readiness['driver_code'] ?? null,
            'capacity_orders' => null,
            'fitness' => null,
            'v1_dispatchable' => $readiness['can_start_deliveries'] ?? null,

            'is_available' => $member->status === PoolMemberStatus::Active
                && ($readiness['can_start_deliveries'] ?? false) === true,

            'is_orphaned' => $readiness === null,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     * @return array<string, int>
     */
    private function counts(array $rows): array
    {
        $vehicles = array_filter($rows, static fn ($r) => $r['member_type'] === PoolMemberType::Vehicle->value);
        $drivers = array_filter($rows, static fn ($r) => $r['member_type'] === PoolMemberType::Driver->value);

        return [
            'members' => count($rows),
            'vehicles' => count($vehicles),
            'drivers' => count($drivers),
            'available' => count(array_filter($rows, static fn ($r) => $r['is_available'])),
            'available_vehicles' => count(array_filter($vehicles, static fn ($r) => $r['is_available'])),
            'available_drivers' => count(array_filter($drivers, static fn ($r) => $r['is_available'])),
            'suspended' => count(array_filter(
                $rows,
                static fn ($r) => $r['membership_status'] === PoolMemberStatus::Suspended->value,
            )),
            'orphaned' => count(array_filter($rows, static fn ($r) => $r['is_orphaned'])),
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     * @return array<int, array<string, mixed>>
     */
    private function indexBy(array $rows, string $key): array
    {
        $out = [];

        foreach ($rows as $row) {
            $out[(int) $row[$key]] = $row;
        }

        return $out;
    }

    /** @return list<int> */
    private function pooledIds(PoolMemberType $type, ?string $companyId): array
    {
        return ResourcePoolMember::query()
            ->where('member_type', $type->value)
            ->where('status', PoolMemberStatus::Active->value)
            ->when(
                $companyId !== null,
                fn ($q) => $q->whereHas('pool', fn ($p) => $p->where('company_id', $companyId)),
            )
            ->pluck('member_id')
            ->map(static fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
    }
}
