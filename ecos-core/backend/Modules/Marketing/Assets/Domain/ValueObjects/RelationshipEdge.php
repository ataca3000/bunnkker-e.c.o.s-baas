<?php

declare(strict_types=1);

namespace Modules\Marketing\Assets\Domain\ValueObjects;

/**
 * Directed edge in the Marketing Relationship Graph.
 *
 * source → target with optional confidence + acceptance state.
 */
final readonly class RelationshipEdge
{
    public function __construct(
        public string $id,
        public string $sourceId,
        public string $targetId,
        public string $label = 'mapped_to',
        public bool $accepted = false,
        public bool $autoSuggested = false,
        public ?int $confidence = null,
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'source' => $this->sourceId,
            'target' => $this->targetId,
            'label' => $this->label,
            'accepted' => $this->accepted,
            'auto_suggested' => $this->autoSuggested,
            'confidence' => $this->confidence,
        ];
    }
}
