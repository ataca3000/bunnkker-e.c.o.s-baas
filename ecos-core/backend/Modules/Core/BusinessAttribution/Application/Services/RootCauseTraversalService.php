<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Application\Services;

use Modules\Core\BusinessAttribution\Domain\Models\BusinessEvent;
use Modules\Core\BusinessAttribution\Domain\ValueObjects\CauseEffectChain;

class RootCauseTraversalService
{
    private const HARD_MAX_DEPTH = 20;

    /**
     * Bidirectional traversal from a given event.
     * Upward = causes (following causation_id chain).
     * Downward = effects (events whose causation_id points here).
     */
    public function traverseFromEvent(string $eventId, int $maxDepth = 10): CauseEffectChain
    {
        $maxDepth = min($maxDepth, self::HARD_MAX_DEPTH);
        $nodes = [];
        $visited = [];

        $root = BusinessEvent::find($eventId);
        if (! $root) {
            return new CauseEffectChain($eventId, [], 0, 0);
        }

        $nodes[] = $this->toNode($root, 0, 'self');
        $visited[$root->id] = true;

        $this->traverseUpward($root, $nodes, $visited, 1, $maxDepth);
        $this->traverseDownward($root->id, $nodes, $visited, 1, $maxDepth);

        // Sort: causes first (negative depth), self (0), effects last (positive depth)
        usort($nodes, static fn (array $a, array $b): int => $a['depth'] <=> $b['depth']);

        return new CauseEffectChain(
            rootEventId: $eventId,
            nodes: $nodes,
            maxDepth: $maxDepth,
            totalNodes: count($nodes),
        );
    }

    /**
     * Return only the upstream cause nodes.
     */
    public function findRootCauses(string $effectEventId): array
    {
        return $this->traverseFromEvent($effectEventId, self::HARD_MAX_DEPTH)->getCauses();
    }

    /**
     * Return only the downstream effect nodes.
     */
    public function findDownstreamEffects(string $causeEventId): array
    {
        return $this->traverseFromEvent($causeEventId, self::HARD_MAX_DEPTH)->getEffects();
    }

    /**
     * BFS shortest path between two events in the cause→effect graph.
     * Returns an ordered list of event UUIDs from $fromEventId to $toEventId,
     * or an empty array if no path exists.
     */
    public function getCriticalPath(string $fromEventId, string $toEventId): array
    {
        $queue = [[$fromEventId]];
        $visited = [$fromEventId => true];

        while (! empty($queue)) {
            $path = array_shift($queue);
            $current = end($path);

            if ($current === $toEventId) {
                return $path;
            }

            $effectIds = BusinessEvent::where('causation_id', $current)
                ->select('id')
                ->pluck('id')
                ->toArray();

            foreach ($effectIds as $effectId) {
                if (isset($visited[$effectId])) {
                    continue;
                }

                $visited[$effectId] = true;
                $newPath = $path;
                $newPath[] = $effectId;
                $queue[] = $newPath;
            }
        }

        return [];
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private function traverseUpward(
        BusinessEvent $event,
        array &$nodes,
        array &$visited,
        int $depth,
        int $maxDepth,
    ): void {
        if ($depth > $maxDepth || ! $event->causation_id) {
            return;
        }

        $cause = BusinessEvent::find($event->causation_id);
        if (! $cause || isset($visited[$cause->id])) {
            return;
        }

        $visited[$cause->id] = true;
        $nodes[] = $this->toNode($cause, -$depth, 'cause');

        $this->traverseUpward($cause, $nodes, $visited, $depth + 1, $maxDepth);
    }

    private function traverseDownward(
        string $parentId,
        array &$nodes,
        array &$visited,
        int $depth,
        int $maxDepth,
    ): void {
        if ($depth > $maxDepth) {
            return;
        }

        $effects = BusinessEvent::where('causation_id', $parentId)->get();

        foreach ($effects as $effect) {
            if (isset($visited[$effect->id])) {
                continue;
            }

            $visited[$effect->id] = true;
            $nodes[] = $this->toNode($effect, $depth, 'effect');

            $this->traverseDownward($effect->id, $nodes, $visited, $depth + 1, $maxDepth);
        }
    }

    private function toNode(BusinessEvent $event, int $depth, string $relation): array
    {
        return [
            'event_id' => $event->id,
            'event_name' => $event->event_name,
            'entity_type' => $event->entity_type,
            'entity_id' => $event->entity_id,
            'occurred_at' => $event->occurred_at->toIso8601String(),
            'causation_id' => $event->causation_id,
            'depth' => $depth,
            'relation' => $relation,
        ];
    }
}
