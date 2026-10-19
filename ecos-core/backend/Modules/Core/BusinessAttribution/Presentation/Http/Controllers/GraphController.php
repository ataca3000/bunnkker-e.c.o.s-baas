<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Core\BusinessAttribution\Application\Services\GraphService;
use Modules\Core\BusinessAttribution\Domain\Enums\NodeType;
use Modules\Core\BusinessAttribution\Domain\Enums\RelationshipType;
use Modules\Core\BusinessAttribution\Domain\Models\EntityNode;
use Modules\Core\BusinessAttribution\Presentation\Http\Resources\EntityNodeResource;

class GraphController extends Controller
{
    public function __construct(
        private readonly GraphService $graphService,
    ) {}

    /** Get a node and its direct neighbours. */
    public function node(EntityNode $entityNode): JsonResponse
    {
        $data = $this->graphService->getNodeWithNeighbors($entityNode->id);

        return response()->json([
            'data' => [
                'node' => new EntityNodeResource($data['node']),
                'outgoing' => $data['outgoing']->map(static fn ($r) => [
                    'id' => $r->id,
                    'relationship_type' => $r->relationship_type instanceof RelationshipType
                        ? $r->relationship_type->value
                        : $r->relationship_type,
                    'weight' => $r->weight,
                    'to_node' => $r->toNode ? new EntityNodeResource($r->toNode) : null,
                ]),
                'incoming' => $data['incoming']->map(static fn ($r) => [
                    'id' => $r->id,
                    'relationship_type' => $r->relationship_type instanceof RelationshipType
                        ? $r->relationship_type->value
                        : $r->relationship_type,
                    'weight' => $r->weight,
                    'from_node' => $r->fromNode ? new EntityNodeResource($r->fromNode) : null,
                ]),
            ],
        ]);
    }

    /** Get a subgraph (BFS up to 2 hops). */
    public function subgraph(Request $request, EntityNode $entityNode): JsonResponse
    {
        $hops = min((int) $request->query('hops', 2), 3);
        $data = $this->graphService->getSubgraph($entityNode->id, $hops);

        return response()->json([
            'data' => [
                'root_node_id' => $entityNode->id,
                'hops' => $hops,
                'node_count' => count($data['nodes']),
                'edge_count' => count($data['edges']),
                'nodes' => EntityNodeResource::collection(collect($data['nodes']))->resolve(),
                'edges' => collect($data['edges'])->map(static fn ($r) => [
                    'id' => $r->id,
                    'from_node_id' => $r->from_node_id,
                    'to_node_id' => $r->to_node_id,
                    'relationship_type' => $r->relationship_type instanceof RelationshipType
                        ? $r->relationship_type->value
                        : $r->relationship_type,
                    'weight' => $r->weight,
                ]),
            ],
        ]);
    }

    /**
     * Register a node (upsert) in the graph.
     * Modules call this when creating new entities.
     */
    public function upsertNode(Request $request): JsonResponse
    {
        $data = $request->validate([
            'node_type' => ['required', 'string'],
            'entity_id' => ['required', 'uuid'],
            'entity_type' => ['required', 'string', 'max:100'],
            'company_id' => ['nullable', 'uuid'],
            'label' => ['nullable', 'string', 'max:255'],
            'properties' => ['nullable', 'array'],
        ]);

        $node = $this->graphService->upsertNode(
            NodeType::from($data['node_type']),
            $data['entity_id'],
            $data['entity_type'],
            $data['company_id'] ?? null,
            $data['label'] ?? null,
            $data['properties'] ?? [],
        );

        return response()->json(['data' => new EntityNodeResource($node)], 201);
    }

    /**
     * Create a relationship edge between two nodes.
     */
    public function createRelationship(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from_node_id' => ['required', 'uuid', 'exists:bae_entity_nodes,id'],
            'to_node_id' => ['required', 'uuid', 'exists:bae_entity_nodes,id'],
            'relationship_type' => ['required', 'string'],
            'weight' => ['nullable', 'numeric', 'min:0', 'max:1'],
            'properties' => ['nullable', 'array'],
        ]);

        $rel = $this->graphService->createRelationship(
            $data['from_node_id'],
            $data['to_node_id'],
            RelationshipType::from($data['relationship_type']),
            (float) ($data['weight'] ?? 1.0),
            $data['properties'] ?? [],
        );

        return response()->json(['data' => [
            'id' => $rel->id,
            'from_node_id' => $rel->from_node_id,
            'to_node_id' => $rel->to_node_id,
            'relationship_type' => $rel->relationship_type->value,
            'weight' => $rel->weight,
        ]], 201);
    }
}
