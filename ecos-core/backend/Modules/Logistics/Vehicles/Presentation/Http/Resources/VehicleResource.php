<?php

declare(strict_types=1);

namespace Modules\Logistics\Vehicles\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Vehicles\Domain\Models\Vehicle;

/**
 * @mixin Vehicle
 */
class VehicleResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,

            // Identity
            'vehicle_code' => $this->vehicle_code,
            'plate_number' => $this->plate_number,
            'name' => $this->name,
            'label' => $this->label(),
            'type' => $this->type->value,
            'type_label' => $this->type->label(),

            // Organisation
            'shipping_company_id' => $this->shipping_company_id,
            'shipping_company_name' => $this->whenLoaded('shippingCompany', fn () => $this->shippingCompany?->name),
            'company_id' => $this->company_id,
            'branch_id' => $this->branch_id,

            // Capacity
            'capacity_orders' => $this->capacity_orders,
            'capacity_weight_kg' => $this->capacity_weight_kg !== null ? (float) $this->capacity_weight_kg : null,
            'capacity_volume_m3' => $this->capacity_volume_m3 !== null ? (float) $this->capacity_volume_m3 : null,

            // Specification
            'fuel_type' => $this->fuel_type?->value,
            'fuel_type_label' => $this->fuel_type?->label(),
            'manufacturer' => $this->manufacturer,
            'model' => $this->model,
            'year' => $this->year,
            'color' => $this->color,
            'vin' => $this->vin,

            // Lifecycle
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'allowed_transitions' => array_map(
                static fn ($s) => ['value' => $s->value, 'label' => $s->label()],
                $this->status->allowedTransitions(),
            ),
            'notes' => $this->notes,

            // Driver pairing — derived from the Drivers module's ledger so the
            // pairing has exactly one source of truth (ADR-024).
            'current_driver' => $this->when(
                $this->relationLoaded('activeAssignment'),
                fn () => $this->activeAssignment?->driver
                    ? [
                        'assignment_id' => $this->activeAssignment->id,
                        'driver_id' => $this->activeAssignment->driver->id,
                        'driver_code' => $this->activeAssignment->driver->driver_code,
                        'full_name' => $this->activeAssignment->driver->full_name,
                        'assigned_at' => $this->activeAssignment->assigned_at?->toIso8601String(),
                    ]
                    : null
            ),
            'has_driver' => $this->when(
                $this->relationLoaded('activeAssignment'),
                fn () => $this->activeAssignment !== null
            ),

            // BR-7 dispatch gate
            'can_be_dispatched' => $this->when(
                $this->relationLoaded('documents'),
                fn () => $this->canBeDispatched()
            ),
            'blocking_expired_documents' => $this->when(
                $this->relationLoaded('documents'),
                fn () => $this->blockingExpiredDocuments()
                    ->map(fn ($d) => ['type' => $d->type->value, 'expired_on' => $d->expires_at?->format('Y-m-d')])
                    ->all()
            ),
            'next_document_expiry' => $this->when(
                $this->relationLoaded('documents'),
                fn () => $this->nextDocumentExpiry()?->format('Y-m-d')
            ),

            'maintenance_records_count' => $this->whenCounted('maintenanceRecords'),
            'documents_count' => $this->whenCounted('documents'),
            'documents' => VehicleDocumentResource::collection($this->whenLoaded('documents')),
            'maintenance_records' => VehicleMaintenanceRecordResource::collection($this->whenLoaded('maintenanceRecords')),

            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
