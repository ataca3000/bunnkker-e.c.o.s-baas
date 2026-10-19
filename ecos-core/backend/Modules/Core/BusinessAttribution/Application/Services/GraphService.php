<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Application\Services;

use Illuminate\Support\Str;
use Modules\Core\BusinessAttribution\Domain\Enums\NodeType;
use Modules\Core\BusinessAttribution\Domain\Enums\RelationshipType;
use Modules\Core\BusinessAttribution\Domain\Models\EntityNode;
use Modules\Core\BusinessAttribution\Domain\Models\EntityRelationship;

/**
 * Business Graph Layer — graph-ready services (no graph database required).
 * Prepares ECOS for future graph migrations by providing a stable API now.
 */
final class GraphService
{
    /**
     * Upsert a node; returns the existing node if already registered.
     */
    public function upsertNode(
        NodeType $nodeType,
        string $entityId,
        string $entityType,
        ?string $companyId = null,
        ?string $label = null,
        array $properties = [],
    ): EntityNode {
        return EntityNode::updateOrCreate(
            ['node_type' => $nodeType->value, 'entity_id' => $entityId],
            [
                'id' => Str::uuid()->toString(),
                'entity_type' => $entityType,
                'company_id' => $companyId,
                'label' => $label,
                'properties' => $properties ?: null,
            ],
        );
    }

    /**
     * Create a directed edge between two nodes (append-only).
     */
    public function createRelationship(
        string $fromNodeId,
        string $toNodeId,
        RelationshipType $type,
        float $weight = 1.0,
        array $properties = [],
    ): EntityRelationship {
        return EntityRelationship::create([
            'id' => Str::uuid()->toString(),
            'from_node_id' => $fromNodeId,
            'to_node_id' => $toNodeId,
            'relationship_type' => $type->value,
            'weight' => $weight,
            'properties' => $properties ?: null,
            'created_at' => now(),
        ]);
    }

    /**
     * Get all direct neighbours of a node with their relationship type.
     *
     * @return array{
     *   node: EntityNode,
     *   outgoing: \Illuminate\Database\Eloquent\Collection,
     *   incoming: \Illuminate\Database\Eloquent\Collection,
     * }
     */
    public function getNodeWithNeighbors(string $nodeId): array
    {
        $node = EntityNode::with([
            'outgoingRelationships.toNode',
            'incomingRelationships.fromNode',
        ])->findOrFail($nodeId);

        return [
            'node' => $node,
            'outgoing' => $node->outgoingRelationships,
            'incoming' => $node->incomingRelationships,
        ];
    }

    /**
     * Find a node by entity reference, or null if not yet registered.
     */
    public function findNode(NodeType $nodeType, string $entityId): ?EntityNode
    {
        return EntityNode::where('node_type', $nodeType->value)
            ->where('entity_id', $entityId)
            ->first();
    }

    /**
     * Get a subgraph: all nodes within N hops of a root node.
     * Returns a flat list of unique nodes (BFS, max 2 hops to keep queries light).
     *
     * @return array{nodes: array<EntityNode>, edges: array<EntityRelationship>}
     */
    public function getSubgraph(string $rootNodeId, int $hops = 2): array
    {
        $visited = collect();
        $edges = collect();
        $frontier = collect([$rootNodeId]);

        for ($hop = 0; $hop < $hops && $frontier->isNotEmpty(); $hop++) {
            $rels = EntityRelationship::with(['fromNode', 'toNode'])
                ->where(static function ($q) use ($frontier): void {
                    $q->whereIn('from_node_id', $frontier)
                        ->orWhereIn('to_node_id', $frontier);
                })->get();

            $nextFrontier = collect();
            foreach ($rels as $rel) {
                $edges->push($rel);
                if (! $visited->contains($rel->from_node_id)) {
                    $nextFrontier->push($rel->from_node_id);
                    $visited->push($rel->from_node_id);
                }
                if (! $visited->contains($rel->to_node_id)) {
                    $nextFrontier->push($rel->to_node_id);
                    $visited->push($rel->to_node_id);
                }
            }
            $frontier = $nextFrontier;
        }

        $nodes = EntityNode::whereIn('id', $visited)->get();

        return [
            'nodes' => $nodes->all(),
            'edges' => $edges->unique('id')->values()->all(),
        ];
    }
}
