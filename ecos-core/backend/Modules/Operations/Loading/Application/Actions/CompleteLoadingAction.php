<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Application\Actions;

use Illuminate\Support\Facades\DB;
use Modules\Operations\Loading\Domain\Enums\LoadingSessionStatus;
use Modules\Operations\Loading\Domain\Events\VehicleLoaded;
use Modules\Operations\Loading\Domain\Exceptions\InvalidLoadingSessionStatusTransitionException;
use Modules\Operations\Loading\Domain\Models\LoadingSession;
use RuntimeException;

final class CompleteLoadingAction
{
    public function execute(LoadingSession $session, string $actorId): LoadingSession
    {
        $status = $session->status instanceof LoadingSessionStatus
            ? $session->status
            : LoadingSessionStatus::from($session->status);

        if ($status !== LoadingSessionStatus::Loading) {
            throw InvalidLoadingSessionStatusTransitionException::from(
                $status,
                LoadingSessionStatus::LoadingComplete,
            );
        }

        return DB::transaction(function () use ($session, $actorId): LoadingSession {
            $pendingTasks = $session->loadingTasks()
                ->whereIn('status', ['pending', 'in_progress'])
                ->count();

            if ($pendingTasks > 0) {
                throw new RuntimeException(
                    "Cannot complete loading: {$pendingTasks} task(s) are still pending or in progress.",
                );
            }

            $session->update([
                'status' => LoadingSessionStatus::LoadingComplete->value,
                'loading_completed_at' => now(),
                'loading_completed_by' => $actorId,
                'updated_by' => $actorId,
            ]);

            $session->load('vehicleAssignments.vehicleInventoryItems');

            foreach ($session->vehicleAssignments as $assignment) {
                $totalUnitsLoaded = (float) $assignment->vehicleInventoryItems->sum('quantity_loaded');
                $loadedProductsCount = $assignment->vehicleInventoryItems->count();

                event(new VehicleLoaded(
                    companyId: $session->company_id,
                    assignmentId: $assignment->id,
                    sessionId: $session->id,
                    vehicleId: $assignment->vehicle_id,
                    totalUnitsLoaded: $totalUnitsLoaded,
                    loadedProductsCount: $loadedProductsCount,
                    actorId: $actorId,
                    occurredAt: now()->toIso8601String(),
                ));
            }

            return $session->fresh() ?? $session;
        });
    }
}
