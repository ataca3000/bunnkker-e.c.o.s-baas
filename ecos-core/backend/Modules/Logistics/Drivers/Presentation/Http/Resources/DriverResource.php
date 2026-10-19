<?php

declare(strict_types=1);

namespace Modules\Logistics\Drivers\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Drivers\Domain\Models\Driver;

/**
 * @mixin Driver
 */
class DriverResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,

            // Identity
            'driver_code' => $this->driver_code,
            'full_name' => $this->full_name,
            'mobile' => $this->mobile,
            'national_id' => $this->national_id,
            'date_of_birth' => $this->date_of_birth?->format('Y-m-d'),
            'address' => $this->address,
            'employment_date' => $this->employment_date?->format('Y-m-d'),

            // Employer
            'shipping_company_id' => $this->shipping_company_id,
            'shipping_company_name' => $this->whenLoaded('shippingCompany', fn () => $this->shippingCompany?->name),

            // Licence — the derived fields drive the expiry warning in the UI
            'license_number' => $this->license_number,
            'license_type' => $this->license_type,
            'license_issue_date' => $this->license_issue_date?->format('Y-m-d'),
            'license_expiry_date' => $this->license_expiry_date?->format('Y-m-d'),
            'license_issuing_authority' => $this->license_issuing_authority,
            'license_status' => $this->licenseStatus(),
            'license_days_remaining' => $this->licenseDaysRemaining(),

            // Lifecycle
            'status' => $this->status,
            'notes' => $this->notes,

            // Current vehicle is DERIVED from the active assignment so there is
            // exactly one source of truth for the pairing (ADR-024).
            // whenLoaded() collapses to null when a loaded relation is empty, which
            // would report has_vehicle as null rather than false. Gate on
            // relationLoaded() instead so the booleans stay honest.
            'current_vehicle' => $this->when(
                $this->relationLoaded('activeAssignment'),
                fn () => $this->activeAssignment?->vehicle
                    ? [
                        'assignment_id' => $this->activeAssignment->id,
                        'vehicle_id' => $this->activeAssignment->vehicle->id,
                        'plate_number' => $this->activeAssignment->vehicle->plate_number,
                        'label' => $this->activeAssignment->vehicle->label(),
                        'assigned_at' => $this->activeAssignment->assigned_at?->toIso8601String(),
                    ]
                    : null
            ),
            'has_vehicle' => $this->when(
                $this->relationLoaded('activeAssignment'),
                fn () => $this->activeAssignment !== null
            ),
            'can_start_deliveries' => $this->when(
                $this->relationLoaded('activeAssignment'),
                fn () => $this->canStartDeliveries()
            ),

            'documents_count' => $this->whenCounted('documents'),
            'assignments_count' => $this->whenCounted('assignments'),
            'documents' => DriverDocumentResource::collection($this->whenLoaded('documents')),
            'assignments' => DriverVehicleAssignmentResource::collection($this->whenLoaded('assignments')),

            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
