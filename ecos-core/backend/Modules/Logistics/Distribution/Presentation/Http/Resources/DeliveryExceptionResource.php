<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Distribution\Domain\Models\DeliveryException;

/**
 * @mixin DeliveryException
 */
class DeliveryExceptionResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'trip_id' => $this->trip_id,
            'stop_id' => $this->stop_id,
            'order_id' => $this->order_id,
            'exception_type' => $this->exception_type,
            'description' => $this->description,
            'photos' => $this->photos ?? [],
            'synced_to_cs' => $this->synced_to_cs,
            'is_resolved' => $this->isResolved(),
            'resolved_at' => $this->resolved_at?->toIso8601String(),
            'resolution_notes' => $this->resolution_notes,
            'reported_by' => $this->reported_by,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
