<?php

declare(strict_types=1);

namespace Modules\Marketing\Assets\Application\Services;

use Modules\Marketing\Assets\Domain\Models\MarketingAsset;
use Modules\Marketing\Assets\Domain\Models\MarketingAssetRelationship;
use Modules\Marketing\Assets\Domain\ValueObjects\RelationshipEdge;
use Modules\Marketing\Assets\Domain\ValueObjects\RelationshipNode;

/**
 * Builds a graph (nodes + edges) of relationships for an asset or connection.
 *
 * Read-only — consumed by the Relationship Graph tab in the Asset Drawer (Part 8).
 * Graph-ready: the output can be fed directly into D3/Cytoscape on the frontend.
 */
final class RelationshipGraphService
{
    /**
     * Build the full relationship graph for a single marketing asset.
     *
     * @return array{nodes: list<array<string, mixed>>, edges: list<array<string, mixed>>}
     */
    public function forAsset(MarketingAsset $asset): array
    {
        $nodes = [];
        $edges = [];

        // Central node: the asset itself
        $assetNodeId = 'asset:'.$asset->id;
        $nodes[$assetNodeId] = new RelationshipNode(
            id: $assetNodeId,
            type: 'asset',
            label: $asset->name,
            subLabel: $asset->asset_type->value ?? null,
            healthStatus: $asset->health_status ?? null,
            connectorType: $asset->connector_type ?? null,
        );

        $relationships = MarketingAssetRelationship::where('marketing_asset_id', $asset->id)
            ->orderBy('confidence', 'desc')
            ->get();

        foreach ($relationships as $rel) {
            $targetNodeId = $rel->related_type.':'.$rel->related_id;

            if (! isset($nodes[$targetNodeId])) {
                $nodes[$targetNodeId] = new RelationshipNode(
                    id: $targetNodeId,
                    type: $rel->related_type,
                    label: $this->labelForRelated($rel->related_type, $rel->related_id),
                    subLabel: $rel->related_type,
                );
            }

            $edges[] = new RelationshipEdge(
                id: $rel->id,
                sourceId: $assetNodeId,
                targetId: $targetNodeId,
                label: 'mapped_to',
                accepted: $rel->accepted_at !== null,
                autoSuggested: (bool) $rel->is_auto_suggested,
                confidence: $rel->confidence,
            );
        }

        return [
            'nodes' => array_values(array_map(fn (RelationshipNode $n) => $n->toArray(), $nodes)),
            'edges' => array_map(fn (RelationshipEdge $e) => $e->toArray(), $edges),
        ];
    }

    /**
     * Build a graph spanning all assets in a connection — useful for the
     * full connector relationship view.
     *
     * @return array{nodes: list<array<string, mixed>>, edges: list<array<string, mixed>>}
     */
    public function forConnection(string $connectionId): array
    {
        $assets = MarketingAsset::where('marketing_connection_id', $connectionId)->get();

        $nodes = [];
        $edges = [];

        foreach ($assets as $asset) {
            $assetNodeId = 'asset:'.$asset->id;
            $nodes[$assetNodeId] = new RelationshipNode(
                id: $assetNodeId,
                type: 'asset',
                label: $asset->name,
                subLabel: $asset->asset_type->value ?? null,
                healthStatus: $asset->health_status ?? null,
                connectorType: $asset->connector_type ?? null,
            );

            foreach ($asset->relationships ?? [] as $rel) {
                $targetNodeId = $rel->related_type.':'.$rel->related_id;

                if (! isset($nodes[$targetNodeId])) {
                    $nodes[$targetNodeId] = new RelationshipNode(
                        id: $targetNodeId,
                        type: $rel->related_type,
                        label: $this->labelForRelated($rel->related_type, $rel->related_id),
                        subLabel: $rel->related_type,
                    );
                }

                $edges[] = new RelationshipEdge(
                    id: $rel->id,
                    sourceId: $assetNodeId,
                    targetId: $targetNodeId,
                    label: 'mapped_to',
                    accepted: $rel->accepted_at !== null,
                    autoSuggested: (bool) $rel->is_auto_suggested,
                    confidence: $rel->confidence,
                );
            }
        }

        return [
            'nodes' => array_values(array_map(fn (RelationshipNode $n) => $n->toArray(), $nodes)),
            'edges' => array_map(fn (RelationshipEdge $e) => $e->toArray(), $edges),
        ];
    }

    private function labelForRelated(string $type, string $id): string
    {
        return ucfirst(str_replace('_', ' ', $type)).' #'.substr($id, 0, 8);
    }
}
