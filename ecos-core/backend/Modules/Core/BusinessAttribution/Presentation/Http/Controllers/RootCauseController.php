<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Core\BusinessAttribution\Application\Actions\TraverseCauseEffectAction;
use Modules\Core\BusinessAttribution\Application\Services\RootCauseTraversalService;
use Modules\Core\BusinessAttribution\Presentation\Http\Resources\CauseEffectChainResource;

class RootCauseController
{
    public function __construct(
        private readonly TraverseCauseEffectAction $traverseAction,
        private readonly RootCauseTraversalService $traversalService,
    ) {}

    /**
     * Bidirectional cause→effect traversal from a given event.
     * GET /bae/cause-effect/{eventId}?direction=both&depth=10
     */
    public function traverse(Request $request, string $eventId): JsonResponse
    {
        $direction = (string) $request->query('direction', 'both');
        $maxDepth = min((int) $request->query('depth', 10), 20);

        $chain = $this->traverseAction->execute($eventId, $direction, $maxDepth);

        return response()->json(new CauseEffectChainResource($chain));
    }

    /**
     * Upstream causes only.
     * GET /bae/cause-effect/{eventId}/root-causes
     */
    public function rootCauses(string $eventId): JsonResponse
    {
        $causes = $this->traversalService->findRootCauses($eventId);

        return response()->json([
            'data' => $causes,
            'event_id' => $eventId,
            'total_causes' => count($causes),
        ]);
    }

    /**
     * Downstream effects only.
     * GET /bae/cause-effect/{eventId}/effects
     */
    public function effects(string $eventId): JsonResponse
    {
        $effects = $this->traversalService->findDownstreamEffects($eventId);

        return response()->json([
            'data' => $effects,
            'event_id' => $eventId,
            'total_effects' => count($effects),
        ]);
    }

    /**
     * Shortest path between two events in the cause→effect graph.
     * GET /bae/cause-effect/path?from={id}&to={id}
     */
    public function criticalPath(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['required', 'string'],
            'to' => ['required', 'string'],
        ]);

        $path = $this->traversalService->getCriticalPath($validated['from'], $validated['to']);

        return response()->json([
            'data' => $path,
            'from' => $validated['from'],
            'to' => $validated['to'],
            'path_length' => count($path),
        ]);
    }
}
