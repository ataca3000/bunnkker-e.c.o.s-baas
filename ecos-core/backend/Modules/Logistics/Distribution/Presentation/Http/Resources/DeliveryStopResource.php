<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Distribution\Domain\Models\DeliveryStop;

/**
 * @mixin DeliveryStop
 */
class DeliveryStopResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'trip_id' => $this->trip_id,
            'order_id' => $this->order_id,
            'sequence' => $this->sequence,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'is_settled' => $this->isSettled(),
            'accepts_payment' => $this->acceptsPayment(),
            'delivery_type' => $this->delivery_type,
            'collected_amount' => (float) $this->collected_amount,
            'payment_method' => $this->payment_method,
            'attempted_at' => $this->attempted_at?->toIso8601String(),
            'completed_at' => $this->completed_at?->toIso8601String(),
            'gps_lat' => $this->gps_lat !== null ? (float) $this->gps_lat : null,
            'gps_lng' => $this->gps_lng !== null ? (float) $this->gps_lng : null,
            'notes' => $this->notes,
            'actions' => DeliveryActionResource::collection($this->whenLoaded('actions')),
            'proof' => new DeliveryProofResource($this->whenLoaded('proof')),
            'payments' => PaymentCollectionResource::collection($this->whenLoaded('payments')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
