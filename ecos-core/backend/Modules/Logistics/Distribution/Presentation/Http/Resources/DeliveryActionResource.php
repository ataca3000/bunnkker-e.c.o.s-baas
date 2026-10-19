<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Distribution\Domain\Models\DeliveryAction;

/**
 * @mixin DeliveryAction
 */
class DeliveryActionResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'stop_id' => $this->stop_id,
            'action_type' => $this->action_type,
            'reason' => $this->reason,
            'notes' => $this->notes,
            'new_delivery_date' => $this->new_delivery_date?->format('Y-m-d'),
            'corrected_lat' => $this->corrected_lat !== null ? (float) $this->corrected_lat : null,
            'corrected_lng' => $this->corrected_lng !== null ? (float) $this->corrected_lng : null,
            'performed_by' => $this->performed_by,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
