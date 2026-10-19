<?php

declare(strict_types=1);

namespace Modules\Marketing\Assets\Domain\ValueObjects;

/**
 * Node in the Marketing Relationship Graph.
 *
 * Follows a generic node model so the graph service is composable
 * with any future Business Graph / Intelligence OS without schema changes.
 */
final readonly class RelationshipNode
{
    public function __construct(
        public string $id,
        public string $type,         // 'asset' | 'brand' | 'channel' | 'product' | ...
        public string $label,
        public ?string $subLabel = null,  // asset_type, category, etc.
        public array $metadata = [],
        public ?string $healthStatus = null,  // only for asset nodes
        public ?string $connectorType = null,  // only for asset nodes
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'label' => $this->label,
            'sub_label' => $this->subLabel,
            'metadata' => $this->metadata,
            'health_status' => $this->healthStatus,
            'connector_type' => $this->connectorType,
        ];
    }
}
