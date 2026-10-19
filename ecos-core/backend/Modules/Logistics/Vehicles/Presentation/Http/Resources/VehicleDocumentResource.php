<?php

declare(strict_types=1);

namespace Modules\Logistics\Vehicles\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Vehicles\Domain\Models\VehicleDocument;

/**
 * @mixin VehicleDocument
 */
class VehicleDocumentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'vehicle_id' => $this->vehicle_id,
            'type' => $this->type->value,
            'type_label' => $this->type->label(),
            'title' => $this->title,
            'reference_number' => $this->reference_number,
            // file_path is deliberately withheld; downloads go through the
            // authenticated endpoint rather than a guessable path.
            'file_name' => $this->file_name,
            'mime_type' => $this->mime_type,
            'size_bytes' => $this->size_bytes,
            'issued_at' => $this->issued_at?->format('Y-m-d'),
            'expires_at' => $this->expires_at?->format('Y-m-d'),
            'is_expired' => $this->isExpired(),
            'is_expiring_soon' => $this->isExpiringSoon(),
            'days_until_expiry' => $this->daysUntilExpiry(),
            'blocks_dispatch' => $this->blocksDispatchWhenExpired(),
            'notes' => $this->notes,
            'uploaded_by' => $this->uploaded_by,
            'download_url' => "/api/logistics/vehicles/{$this->vehicle_id}/documents/{$this->id}/download",
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
