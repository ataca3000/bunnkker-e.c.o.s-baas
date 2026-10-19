<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Application\Actions;

use Illuminate\Support\Facades\DB;
use Modules\Operations\Loading\Domain\Enums\VehicleAssignmentStatus;
use Modules\Operations\Loading\Domain\Events\VehicleAssigned;
use Modules\Operations\Loading\Domain\Models\LoadingSession;
use Modules\Operations\Loading\Domain\Models\VehicleAssignment;
use Modules\Operations\Loading\Domain\Services\VehicleAssignmentNumberGenerator;

final class AssignVehicleToSessionAction
{
    public function __construct(
        private readonly VehicleAssignmentNumberGenerator $numberGen,
    ) {}

    public function execute(
        LoadingSession $session,
        string $vehicleId,
        string $vehicleRegistration,
        string $vehicleType,
        float $capacityWeightKg,
        float $capacityVolumeM3,
        bool $refrigerated,
        string $actorId,
        ?string $vehiclePlanSlotId = null,
        ?string $notes = null,
    ): VehicleAssignment {
        return DB::transaction(function () use (
            $session,
            $vehicleId,
            $vehicleRegistration,
            $vehicleType,
            $capacityWeightKg,
            $capacityVolumeM3,
            $refrigerated,
            $actorId,
            $vehiclePlanSlotId,
            $notes,
        ): VehicleAssignment {
            $assignmentNumber = $this->numberGen->next($session->company_id);

            $assignment = VehicleAssignment::create([
                'company_id' => $session->company_id,
                'loading_session_id' => $session->id,
                'vehicle_plan_slot_id' => $vehiclePlanSlotId,
                'vehicle_id' => $vehicleId,
                'vehicle_registration_snapshot' => $vehicleRegistration,
                'vehicle_type_snapshot' => $vehicleType,
                'capacity_weight_kg_snapshot' => $capacityWeightKg,
                'capacity_volume_m3_snapshot' => $capacityVolumeM3,
                'refrigerated_snapshot' => $refrigerated,
                'assignment_number' => $assignmentNumber,
                'status' => VehicleAssignmentStatus::Pending->value,
                'loading_weight_kg' => 0.0,
                'loading_volume_m3' => 0.0,
                'notes' => $notes,
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);

            $session->increment('vehicles_count');

            event(new VehicleAssigned(
                companyId: $session->company_id,
                assignmentId: $assignment->id,
                assignmentNumber: $assignmentNumber,
                sessionId: $session->id,
                vehicleId: $vehicleId,
                vehicleRegistration: $vehicleRegistration,
                actorId: $actorId,
                occurredAt: now()->toIso8601String(),
            ));

            return $assignment;
        });
    }
}
