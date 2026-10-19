<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Application\Actions;

use Illuminate\Support\Facades\DB;
use Modules\Operations\Loading\Domain\Enums\LoadingSessionStatus;
use Modules\Operations\Loading\Domain\Events\AllocationCompleted;
use Modules\Operations\Loading\Domain\Exceptions\InvalidLoadingSessionStatusTransitionException;
use Modules\Operations\Loading\Domain\Models\LoadingSession;

final class CompleteAllocationAction
{
    public function execute(LoadingSession $session, string $actorId): LoadingSession
    {
        $status = $session->status instanceof LoadingSessionStatus
            ? $session->status
            : LoadingSessionStatus::from($session->status);

        if ($status !== LoadingSessionStatus::Allocating) {
            throw InvalidLoadingSessionStatusTransitionException::from(
                $status,
                LoadingSessionStatus::Allocated,
            );
        }

        return DB::transaction(function () use ($session, $actorId): LoadingSession {
            $session->update([
                'status' => LoadingSessionStatus::Allocated->value,
                'allocation_completed_at' => now(),
                'updated_by' => $actorId,
            ]);

            $vehicleCount = $session->vehicleAssignments()->count();
            $ordersAllocated = $session->vehicleAssignments()
                ->withSum('allocationRecords', 'quantity_allocated')
                ->get()
                ->count();
            $partialAllocations = $session->vehicleAssignments()
                ->join('allocation_records', 'allocation_records.vehicle_assignment_id', '=', 'vehicle_assignments.id')
                ->where('allocation_records.is_partial', true)
                ->count();

            event(new AllocationCompleted(
                companyId: $session->company_id,
                sessionId: $session->id,
                vehicleCount: $vehicleCount,
                ordersAllocated: $ordersAllocated,
                partialAllocations: $partialAllocations,
                actorId: $actorId,
                occurredAt: now()->toIso8601String(),
            ));

            return $session->fresh() ?? $session;
        });
    }
}
