<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Application\Actions;

use Illuminate\Support\Facades\DB;
use Modules\Operations\Loading\Domain\Enums\DriverAssignmentStatus;
use Modules\Operations\Loading\Domain\Events\DriverAssigned;
use Modules\Operations\Loading\Domain\Models\DriverAssignment;
use Modules\Operations\Loading\Domain\Models\VehicleAssignment;
use RuntimeException;

final class AssignDriverAction
{
    public function execute(
        VehicleAssignment $assignment,
        string $driverId,
        string $driverName,
        string $assignedBy,
        ?string $driverPhone = null,
        string $assignmentType = 'primary',
    ): DriverAssignment {
        return DB::transaction(function () use (
            $assignment,
            $driverId,
            $driverName,
            $assignedBy,
            $driverPhone,
            $assignmentType,
        ): DriverAssignment {
            $existing = DriverAssignment::where('vehicle_assignment_id', $assignment->id)
                ->where('status', DriverAssignmentStatus::Assigned->value)
                ->exists();

            if ($existing) {
                throw new RuntimeException(
                    "Vehicle assignment '{$assignment->assignment_number}' already has an active driver assigned.",
                );
            }

            $driverAssignment = DriverAssignment::create([
                'company_id' => $assignment->company_id,
                'vehicle_assignment_id' => $assignment->id,
                'loading_session_id' => $assignment->loading_session_id,
                'vehicle_id' => $assignment->vehicle_id,
                'driver_id' => $driverId,
                'driver_name_snapshot' => $driverName,
                'driver_phone_snapshot' => $driverPhone,
                'status' => DriverAssignmentStatus::Assigned->value,
                'assignment_type' => $assignmentType,
                'assigned_at' => now(),
                'assigned_by' => $assignedBy,
                'created_by' => $assignedBy,
                'updated_by' => $assignedBy,
            ]);

            event(new DriverAssigned(
                companyId: $assignment->company_id,
                driverAssignmentId: $driverAssignment->id,
                vehicleAssignmentId: $assignment->id,
                vehicleId: $assignment->vehicle_id,
                driverId: $driverId,
                driverName: $driverName,
                actorId: $assignedBy,
                occurredAt: now()->toIso8601String(),
            ));

            return $driverAssignment;
        });
    }
}
