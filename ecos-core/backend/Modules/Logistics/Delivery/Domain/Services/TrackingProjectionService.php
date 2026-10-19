<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Services;

use Modules\Logistics\Delivery\Domain\Models\Delivery;
use Modules\Logistics\Delivery\Domain\Models\DeliveryAttempt;
use Modules\Logistics\Delivery\Domain\Models\TrackingEvent;

/**
 * Folds domain activity into the append-only tracking stream.
 *
 * Visibility is decided here, in one place, so the public tracking page can
 * never accidentally surface an internal note.
 */
class TrackingProjectionService
{
    public function record(
        Delivery $delivery,
        string $eventType,
        string $title,
        ?string $description = null,
        string $visibility = TrackingEvent::VISIBILITY_INTERNAL,
        ?DeliveryAttempt $attempt = null,
        array $metadata = [],
        ?string $actorName = null,
        ?int $actorId = null,
    ): TrackingEvent {
        return TrackingEvent::create([
            'delivery_id' => $delivery->id,
            'attempt_id' => $attempt?->id,
            'event_type' => $eventType,
            'visibility' => $visibility,
            'title' => $title,
            'description' => $description,
            'metadata' => $metadata === [] ? null : $metadata,
            'gps_lat' => $attempt?->gps_lat,
            'gps_lng' => $attempt?->gps_lng,
            'actor_name' => $actorName,
            'actor_id' => $actorId,
            'occurred_at' => now(),
        ]);
    }

    public function recordCustomerVisible(
        Delivery $delivery,
        string $eventType,
        string $title,
        ?string $description = null,
        ?DeliveryAttempt $attempt = null,
        ?string $actorName = null,
    ): TrackingEvent {
        return $this->record(
            $delivery,
            $eventType,
            $title,
            $description,
            TrackingEvent::VISIBILITY_CUSTOMER,
            $attempt,
            [],
            $actorName,
        );
    }

    /**
     * The customer-safe view: only customer-visible entries, and never any
     * internal note, actor identity or metadata.
     *
     * @return array<int, array<string, mixed>>
     */
    public function publicTimeline(Delivery $delivery): array
    {
        return $delivery->trackingEvents()
            ->where('visibility', TrackingEvent::VISIBILITY_CUSTOMER)
            ->orderBy('occurred_at')
            ->get()
            ->map(static fn (TrackingEvent $e) => [
                'event_type' => $e->event_type,
                'title' => $e->title,
                'description' => $e->description,
                'occurred_at' => $e->occurred_at?->toIso8601String(),
            ])
            ->all();
    }
}
