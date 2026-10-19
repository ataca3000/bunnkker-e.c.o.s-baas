<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Application\Services;

use Illuminate\Support\Collection;
use Modules\Core\BusinessAttribution\Domain\Models\BusinessEvent;

/**
 * Business Event Replay Engine.
 * Replays ordered event sequences for AI training, debugging, analytics, and auditing.
 */
final class EventReplayService
{
    /**
     * Replay all events for an entity (e.g., order, customer, shipment) in occurrence order.
     *
     * @return array{
     *   entity_type: string,
     *   entity_id: string,
     *   total_events: int,
     *   events: Collection<int, BusinessEvent>,
     *   replayed_at: string,
     * }
     */
    public function replayForEntity(string $entityType, string $entityId): array
    {
        $events = BusinessEvent::where('entity_type', $entityType)
            ->where('entity_id', $entityId)
            ->orderBy('occurred_at')
            ->get();

        return [
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'total_events' => $events->count(),
            'events' => $events,
            'replayed_at' => now()->toIso8601String(),
        ];
    }

    /**
     * Replay all events attached to a Business DNA record.
     *
     * @return array{
     *   dna_id: string,
     *   total_events: int,
     *   events: Collection<int, BusinessEvent>,
     *   replayed_at: string,
     * }
     */
    public function replayForDna(string $dnaId): array
    {
        $events = BusinessEvent::where('business_dna_id', $dnaId)
            ->orderBy('occurred_at')
            ->get();

        return [
            'dna_id' => $dnaId,
            'total_events' => $events->count(),
            'events' => $events,
            'replayed_at' => now()->toIso8601String(),
        ];
    }

    /**
     * Replay all events sharing a correlation ID (distributed operation trace).
     *
     * @return array{
     *   correlation_id: string,
     *   total_events: int,
     *   events: Collection<int, BusinessEvent>,
     *   replayed_at: string,
     * }
     */
    public function replayForCorrelation(string $correlationId): array
    {
        $events = BusinessEvent::where('correlation_id', $correlationId)
            ->orderBy('occurred_at')
            ->get();

        return [
            'correlation_id' => $correlationId,
            'total_events' => $events->count(),
            'events' => $events,
            'replayed_at' => now()->toIso8601String(),
        ];
    }

    /**
     * Replay a campaign conversion journey: all events attributed to a campaign.
     *
     * @return array{
     *   campaign_id: string,
     *   total_events: int,
     *   events: Collection<int, BusinessEvent>,
     *   replayed_at: string,
     * }
     */
    public function replayCampaignJourney(string $campaignId): array
    {
        $events = BusinessEvent::whereJsonContains('payload->campaign_id', $campaignId)
            ->orWhere(function ($q) use ($campaignId): void {
                $q->whereHas('dna', fn ($d) => $d->where('campaign_id', $campaignId));
            })
            ->orderBy('occurred_at')
            ->get();

        return [
            'campaign_id' => $campaignId,
            'total_events' => $events->count(),
            'events' => $events,
            'replayed_at' => now()->toIso8601String(),
        ];
    }
}
