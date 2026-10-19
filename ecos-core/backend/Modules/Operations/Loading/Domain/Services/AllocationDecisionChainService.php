<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Services;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Operations\Loading\Domain\Exceptions\ManualAllocationRequiresReasonException;
use Modules\Operations\Loading\Domain\Models\AllocationDecision;
use Modules\Operations\Loading\Domain\Models\AllocationRecord;

final class AllocationDecisionChainService
{
    /**
     * Record the initial system allocation (revision_number = 1).
     */
    public function recordSystemAllocation(
        AllocationRecord $record,
        float $quantityAllocated,
    ): AllocationDecision {
        return DB::transaction(function () use ($record, $quantityAllocated): AllocationDecision {
            $decision = AllocationDecision::create([
                'id' => Str::ulid()->toBase32(),
                'company_id' => $record->company_id,
                'allocation_record_id' => $record->id,
                'revision_number' => 1,
                'actor_type' => 'system',
                'actor_id' => null,
                'quantity_before' => 0.0,
                'quantity_after' => $quantityAllocated,
                'reason' => 'System auto-allocation',
                'recorded_at' => now(),
            ]);

            $record->update([
                'quantity_allocated' => $quantityAllocated,
                'last_decision_id' => $decision->id,
                'allocated_by' => 'system',
                'allocated_by_user_id' => null,
                'updated_by' => 'system',
            ]);

            return $decision;
        });
    }

    /**
     * Record a dispatcher override (reason REQUIRED).
     */
    public function recordDispatcherOverride(
        AllocationRecord $record,
        float $newQuantity,
        string $dispatcherId,
        string $reason,
    ): AllocationDecision {
        if (trim($reason) === '') {
            throw ManualAllocationRequiresReasonException::make();
        }

        return $this->recordOverride($record, $newQuantity, 'dispatcher', $dispatcherId, $reason);
    }

    /**
     * Record a driver override (reason REQUIRED).
     */
    public function recordDriverOverride(
        AllocationRecord $record,
        float $newQuantity,
        string $driverId,
        string $reason,
    ): AllocationDecision {
        if (trim($reason) === '') {
            throw ManualAllocationRequiresReasonException::make();
        }

        return $this->recordOverride($record, $newQuantity, 'driver', $driverId, $reason);
    }

    /**
     * Get the full decision chain for an allocation record (ordered by revision_number ASC).
     */
    public function getDecisionChain(string $allocationRecordId): Collection
    {
        return AllocationDecision::where('allocation_record_id', $allocationRecordId)
            ->orderBy('revision_number', 'asc')
            ->get();
    }

    private function recordOverride(
        AllocationRecord $record,
        float $newQuantity,
        string $actorType,
        string $actorId,
        string $reason,
    ): AllocationDecision {
        return DB::transaction(function () use ($record, $newQuantity, $actorType, $actorId, $reason): AllocationDecision {
            $nextRevision = (AllocationDecision::where('allocation_record_id', $record->id)->max('revision_number') ?? 0) + 1;

            $decision = AllocationDecision::create([
                'id' => Str::ulid()->toBase32(),
                'company_id' => $record->company_id,
                'allocation_record_id' => $record->id,
                'revision_number' => $nextRevision,
                'actor_type' => $actorType,
                'actor_id' => $actorId,
                'quantity_before' => $record->quantity_allocated,
                'quantity_after' => $newQuantity,
                'reason' => $reason,
                'recorded_at' => now(),
            ]);

            $record->update([
                'quantity_allocated' => $newQuantity,
                'last_decision_id' => $decision->id,
                'allocated_by' => $actorType,
                'allocated_by_user_id' => $actorId,
                'updated_by' => $actorId,
            ]);

            return $decision;
        });
    }
}
