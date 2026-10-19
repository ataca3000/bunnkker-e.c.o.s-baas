<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Delivery\Domain\Models\TrackingEvent;

/**
 * @mixin TrackingEvent
 *
 * Internal projection. The customer-facing timeline is redacted separately by
 * TrackingProjectionService::publicTimeline() and never reuses this resource.
 */
class TrackingEventResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'delivery_id' => $this->delivery_id,
            'attempt_id' => $this->attempt_id,
            'event_type' => $this->event_type,
            'title' => $this->title,
            'description' => $this->description,
            'visibility' => $this->visibility,
            'customer_visible' => $this->isCustomerVisible(),
            'occurred_at' => $this->occurred_at?->toIso8601String(),
            'gps_lat' => $this->gps_lat !== null ? (float) $this->gps_lat : null,
            'gps_lng' => $this->gps_lng !== null ? (float) $this->gps_lng : null,
            'actor_name' => $this->actor_name,
            'actor_id' => $this->actor_id,
            'metadata' => $this->metadata ?? [],
        ];
    }
}
