<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\ValueObjects;

final readonly class CauseEffectChain
{
    public function __construct(
        public string $rootEventId,
        /** Each node: {event_id, event_name, entity_type, entity_id, occurred_at, causation_id, depth, relation} */
        public array $nodes,
        public int $maxDepth,
        public int $totalNodes,
        public array $criticalPath = [],
    ) {}

    public function getCauses(): array
    {
        return array_values(array_filter(
            $this->nodes,
            static fn (array $n): bool => $n['relation'] === 'cause',
        ));
    }

    public function getEffects(): array
    {
        return array_values(array_filter(
            $this->nodes,
            static fn (array $n): bool => $n['relation'] === 'effect',
        ));
    }

    public function getDepthAt(string $eventId): int
    {
        foreach ($this->nodes as $node) {
            if ($node['event_id'] === $eventId) {
                return $node['depth'];
            }
        }

        return -1;
    }

    public function toArray(): array
    {
        return [
            'root_event_id' => $this->rootEventId,
            'total_nodes' => $this->totalNodes,
            'max_depth' => $this->maxDepth,
            'nodes' => $this->nodes,
            'critical_path' => $this->criticalPath,
            'causes' => $this->getCauses(),
            'effects' => $this->getEffects(),
        ];
    }
}
