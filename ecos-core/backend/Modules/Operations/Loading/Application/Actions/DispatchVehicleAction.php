<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Application\Actions;

use Illuminate\Support\Facades\DB;
use Modules\Operations\Fulfillment\Application\Workflows\LoadVehicleWorkflow;
use Modules\Operations\Loading\Domain\Enums\DriverAssignmentStatus;
use Modules\Operations\Loading\Domain\Enums\VehicleAssignmentStatus;
use Modules\Operations\Loading\Domain\Events\VehicleReleased;
use Modules\Operations\Loading\Domain\Models\VehicleAssignment;
use RuntimeException;

final class DispatchVehicleAction
{
    public function __construct(
        private readonly LoadVehicleWorkflow $loadVehicleWorkflow,
    ) {}

    public function execute(VehicleAssignment $assignment, string $actorId): VehicleAssignment
    {
        $status = $assignment->status instanceof VehicleAssignmentStatus
            ? $assignment->status
            : VehicleAssignmentStatus::from($assignment->status);

        if ($status !== VehicleAssignmentStatus::LoadingComplete) {
            throw new RuntimeException(
                "Cannot dispatch vehicle assignment '{$assignment->assignment_number}': status must be 'loading_complete', current status is '{$status->value}'.",
            );
        }

        return DB::transaction(function () use ($assignment, $actorId): VehicleAssignment {
            $driverAssignment = $assignment->driverAssignment()
                ->where('status', DriverAssignmentStatus::Assigned->value)
                ->first();

            if ($driverAssignment === null) {
                throw new RuntimeException(
                    "Cannot dispatch vehicle assignment '{$assignment->assignment_number}': no active driver assignment found.",
                );
            }

            $assignment->update([
                'status' => VehicleAssignmentStatus::Dispatched->value,
                'dispatched_at' => now(),
                'dispatched_by' => $actorId,
                'updated_by' => $actorId,
            ]);

            $driverAssignment->update([
                'status' => DriverAssignmentStatus::OnTrip->value,
                'departure_time_actual' => now(),
                'updated_by' => $actorId,
            ]);

            // Ship inventory for all orders on this vehicle and advance their status to out_for_delivery.
            // Runs as a savepoint inside this transaction — failure rolls back both dispatch + shipping.
            $this->loadVehicleWorkflow->execute($assignment, $actorId);

            event(new VehicleReleased(
                companyId: $assignment->company_id,
                assignmentId: $assignment->id,
                sessionId: $assignment->loading_session_id,
                vehicleId: $assignment->vehicle_id,
                driverId: $driverAssignment->driver_id,
                actorId: $actorId,
                occurredAt: now()->toIso8601String(),
            ));

            return $assignment->fresh() ?? $assignment;
        });
    }
}
