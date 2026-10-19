<?php

declare(strict_types=1);

namespace Modules\Crm\Engagement\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Crm\Engagement\Domain\ValueObjects\TimelineEntry;

/**
 * The Customer Journey — a deterministic read model derived from the timeline.
 *
 * Summarises the relationship: when it began, the last interaction, engagement
 * counts by source/channel/type, the order milestones and a rule-based current
 * stage. Explainable and read-only — it derives from the timeline, storing
 * nothing.
 */
final class CustomerJourneyService
{
    public function __construct(private readonly TimelineService $timeline) {}

    /** @return array<string, mixed> */
    public function journey(string $companyId, string $customerId): array
    {
        /** @var list<TimelineEntry> $entries (sorted newest-first) */
        $entries = $this->timeline->collect($companyId, $customerId);

        if ($entries === []) {
            return ['stage' => 'new', 'explanation' => 'No recorded engagement yet.', 'milestones' => [], 'engagement' => $this->emptyEngagement()];
        }

        $interactions = array_values(array_filter($entries, static fn (TimelineEntry $e) => $e->isInteraction()));
        $orders = array_values(array_filter($entries, static fn (TimelineEntry $e) => $e->type === 'order'));

        $firstSeen = end($entries)->occurredAt;              // oldest
        $lastInteraction = $interactions !== [] ? $interactions[0]->occurredAt : null;
        $daysSince = $lastInteraction !== null ? (int) $lastInteraction->diffInDays(Carbon::now()) : null;

        [$stage, $explanation] = $this->stage(count($orders), $daysSince);

        return [
            'stage' => $stage,
            'explanation' => $explanation,
            'first_seen' => $firstSeen->toIso8601String(),
            'last_interaction' => $lastInteraction?->toIso8601String(),
            'days_since_last_interaction' => $daysSince,
            'milestones' => $this->milestones($entries, $orders),
            'engagement' => [
                'total_entries' => count($entries),
                'total_interactions' => count($interactions),
                'total_orders' => count($orders),
                'by_source' => $this->countBy($entries, static fn (TimelineEntry $e) => $e->source),
                'by_channel' => $this->countBy($entries, static fn (TimelineEntry $e) => $e->channel ?? 'other'),
                'by_type' => $this->countBy($entries, static fn (TimelineEntry $e) => $e->type),
            ],
        ];
    }

    /** @return array{0: string, 1: string} */
    private function stage(int $orderCount, ?int $daysSince): array
    {
        if ($orderCount === 0) {
            return $daysSince === null
                ? ['prospect', 'Engaged but no orders yet.']
                : ['prospect', 'Interacted but has not ordered.'];
        }
        if ($daysSince !== null && $daysSince > 90) {
            return ['at_risk', "Has ordered, but no interaction in {$daysSince} days."];
        }

        return ['active', 'Ordering and recently engaged.'];
    }

    /**
     * @param  list<TimelineEntry>  $entries
     * @param  list<TimelineEntry>  $orders
     * @return list<array<string, mixed>>
     */
    private function milestones(array $entries, array $orders): array
    {
        $milestones = [];
        $oldest = end($entries);
        if ($oldest !== false) {
            $milestones[] = ['label' => 'First contact', 'at' => $oldest->occurredAt->toIso8601String(), 'via' => $oldest->source];
        }
        if ($orders !== []) {
            $firstOrder = end($orders);
            $milestones[] = ['label' => 'First order', 'at' => $firstOrder->occurredAt->toIso8601String(), 'ref' => $firstOrder->refId];
            $milestones[] = ['label' => 'Latest order', 'at' => $orders[0]->occurredAt->toIso8601String(), 'ref' => $orders[0]->refId];
        }

        return $milestones;
    }

    /**
     * @param  list<TimelineEntry>  $entries
     * @return array<string, int>
     */
    private function countBy(array $entries, callable $key): array
    {
        $out = [];
        foreach ($entries as $e) {
            $k = (string) $key($e);
            $out[$k] = ($out[$k] ?? 0) + 1;
        }

        return $out;
    }

    /** @return array<string, mixed> */
    private function emptyEngagement(): array
    {
        return ['total_entries' => 0, 'total_interactions' => 0, 'total_orders' => 0, 'by_source' => [], 'by_channel' => [], 'by_type' => []];
    }
}
