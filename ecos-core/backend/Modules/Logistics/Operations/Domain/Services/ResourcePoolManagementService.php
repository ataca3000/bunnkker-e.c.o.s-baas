<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Services;

use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;
use Modules\Logistics\Operations\Domain\Enums\PoolMemberStatus;
use Modules\Logistics\Operations\Domain\Enums\PoolMemberType;
use Modules\Logistics\Operations\Domain\Enums\PoolStatus;
use Modules\Logistics\Operations\Domain\Exceptions\OperationsException;
use Modules\Logistics\Operations\Domain\Models\ResourcePool;
use Modules\Logistics\Operations\Domain\Models\ResourcePoolMember;

/**
 * Pool lifecycle and membership — the only writer of ops_resource_pools and
 * ops_resource_pool_members.
 *
 * Membership is the whole of this service's business. It never asks whether a
 * vehicle is roadworthy or a driver is licensed; those questions belong to Fleet
 * and Drivers, and UnifiedResourcePoolService is where the answers are fetched.
 */
class ResourcePoolManagementService
{
    /** @param array<string, mixed> $attributes */
    public function create(array $attributes, ?int $actorId = null): ResourcePool
    {
        $pool = new ResourcePool($attributes);
        $pool->created_by = $actorId;
        $pool->save();

        return $pool->refresh();
    }

    public function setStatus(
        ResourcePool $pool,
        PoolStatus $target,
        ?string $reason = null,
    ): ResourcePool {
        if (! $pool->status->canTransitionTo($target)) {
            throw OperationsException::invalidPoolTransition($pool->status, $target);
        }

        $pool->update([
            'status' => $target->value,
            'status_reason' => $reason,
        ]);

        return $pool->refresh();
    }

    // ── Membership ───────────────────────────────────────────────────────────

    /**
     * Put a resource in a pool.
     *
     * Uniqueness is the database's job. A read-then-write check is exactly how
     * two concurrent adds both pass and both insert, so we let the unique index
     * refuse the second one and translate what it says.
     */
    public function addMember(
        ResourcePool $pool,
        PoolMemberType $memberType,
        int $memberId,
        ?string $reason = null,
        ?int $actorId = null,
    ): ResourcePoolMember {
        if (! $pool->pool_type->accepts($memberType)) {
            throw OperationsException::memberTypeNotAccepted($pool->pool_type, $memberType->label());
        }

        try {
            return $pool->members()->create([
                'member_type' => $memberType->value,
                'member_id' => $memberId,
                'status' => PoolMemberStatus::Active->value,
                'membership_reason' => $reason,
                'joined_at' => Carbon::now(),
                'active_flag' => 1,
                'created_by' => $actorId,
            ])->refresh();
        } catch (QueryException $e) {
            if ($this->isUniqueViolation($e)) {
                throw OperationsException::alreadyInPool($memberType->label(), $memberId);
            }

            throw $e;
        }
    }

    /** Hold a member out without losing the record that it belongs here. */
    public function suspendMember(ResourcePoolMember $member, ?string $reason = null): ResourcePoolMember
    {
        return $this->transitionMember($member, PoolMemberStatus::Suspended, $reason);
    }

    public function reinstateMember(ResourcePoolMember $member, ?string $reason = null): ResourcePoolMember
    {
        return $this->transitionMember($member, PoolMemberStatus::Active, $reason);
    }

    /**
     * Take a resource out for good.
     *
     * The reason is mandatory: without one, nobody can tell six months later
     * whether the vehicle was sold or simply lent to another depot for a week.
     */
    public function withdrawMember(ResourcePoolMember $member, string $reason): ResourcePoolMember
    {
        if (trim($reason) === '') {
            throw OperationsException::withdrawalReasonRequired();
        }

        $member = $this->transitionMember($member, PoolMemberStatus::Withdrawn, $reason);

        // Clearing the flag frees the unique key so the resource can be added
        // again later — the same partial-unique emulation Phase 3 uses.
        $member->update([
            'active_flag' => null,
            'left_at' => Carbon::now(),
        ]);

        return $member->refresh();
    }

    private function transitionMember(
        ResourcePoolMember $member,
        PoolMemberStatus $target,
        ?string $reason,
    ): ResourcePoolMember {
        if ($member->status === $target) {
            return $member;
        }

        if (! $member->status->canTransitionTo($target)) {
            throw OperationsException::invalidMemberTransition($member->status, $target);
        }

        $member->update([
            'status' => $target->value,
            'status_reason' => $reason,
        ]);

        return $member->refresh();
    }

    private function isUniqueViolation(QueryException $e): bool
    {
        // 23000 covers MySQL's integrity constraint violations; 23505 is
        // PostgreSQL's unique_violation.
        return in_array($e->getCode(), ['23000', '23505'], true);
    }
}
