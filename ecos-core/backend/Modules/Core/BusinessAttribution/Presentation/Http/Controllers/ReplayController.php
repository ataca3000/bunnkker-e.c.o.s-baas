<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Presentation\Http\Controllers;

use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Core\BusinessAttribution\Application\Actions\ReplayEventsAction;
use Modules\Core\BusinessAttribution\Application\Services\EnhancedReplayService;
use Modules\Core\BusinessAttribution\Application\Services\ReplayAuditService;
use Modules\Core\BusinessAttribution\Domain\ValueObjects\ReplayContext;
use Modules\Core\BusinessAttribution\Presentation\Http\Resources\BusinessEventResource;
use Modules\Core\BusinessAttribution\Presentation\Http\Resources\ReplayAuditLogResource;
use Modules\Core\BusinessAttribution\Presentation\Http\Resources\ReplayResultResource;

class ReplayController extends Controller
{
    public function __construct(
        private readonly ReplayEventsAction $replayAction,
        private readonly EnhancedReplayService $enhancedReplay,
        private readonly ReplayAuditService $auditService,
    ) {}

    // ─── Existing endpoint — backwards-compatible ─────────────────────────────

    /** POST /bae/replay — replay any event sequence by type. */
    public function replay(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', 'in:entity,dna,correlation,campaign'],
            'entity_type' => ['required_if:type,entity', 'nullable', 'string'],
            'entity_id' => ['required_if:type,entity', 'nullable', 'uuid'],
            'dna_id' => ['required_if:type,dna', 'nullable', 'uuid'],
            'correlation_id' => ['required_if:type,correlation', 'nullable', 'uuid'],
            'campaign_id' => ['required_if:type,campaign', 'nullable', 'uuid'],
        ]);

        $result = $this->replayAction->execute($data['type'], $data);

        return response()->json([
            'data' => array_merge($result, [
                'events' => BusinessEventResource::collection(
                    is_iterable($result['events']) ? collect($result['events']) : $result['events'],
                )->resolve(),
            ]),
        ]);
    }

    // ─── Enhanced entity replay ───────────────────────────────────────────────

    /** GET /bae/replay/entity/{entityType}/{entityId}?from=&to= */
    public function replayEntity(Request $request, string $entityType, string $entityId): JsonResponse
    {
        $from = $request->query('from') ? Carbon::parse((string) $request->query('from')) : null;
        $to = $request->query('to') ? Carbon::parse((string) $request->query('to')) : null;

        $context = ($from && $to)
            ? ReplayContext::timeline($entityType, $entityId, $from, $to)
            : ReplayContext::entity($entityType, $entityId, $request->user()?->id);

        $result = $this->enhancedReplay->replayWithContext($context);
        $this->auditService->log($context, $result, 'completed', $request->user()?->id);

        return response()->json(new ReplayResultResource($result));
    }

    // ─── Batch replay ─────────────────────────────────────────────────────────

    /** POST /bae/replay/batch */
    public function batch(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'entities' => ['required', 'array', 'min:1', 'max:50'],
            'entities.*.entity_type' => ['required', 'string'],
            'entities.*.entity_id' => ['required', 'string'],
        ]);

        $results = $this->enhancedReplay->batchReplay($validated['entities']);

        return response()->json([
            'data' => array_map(
                fn ($r) => (new ReplayResultResource($r))->toArray(request()),
                $results,
            ),
            'total' => count($results),
        ]);
    }

    // ─── Module replay ────────────────────────────────────────────────────────

    /** GET /bae/replay/module/{module}?from=&to= */
    public function replayModule(Request $request, string $module): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after:from'],
        ]);

        $result = $this->enhancedReplay->replayModule(
            $module,
            Carbon::parse($validated['from']),
            Carbon::parse($validated['to']),
        );

        return response()->json(new ReplayResultResource($result));
    }

    // ─── Audit log ───────────────────────────────────────────────────────────

    /** GET /bae/replay/audit */
    public function auditLogs(Request $request): JsonResponse
    {
        $logs = $this->auditService->list(
            $request->only(['entity_type', 'entity_id', 'user_id', 'replay_type', 'date_from', 'date_to']),
            (int) $request->query('per_page', 25),
        );

        return response()->json([
            'data' => ReplayAuditLogResource::collection($logs->items())->resolve(),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
        ]);
    }

    /** GET /bae/replay/audit/stats */
    public function auditStats(): JsonResponse
    {
        return response()->json(['data' => $this->auditService->getStats()]);
    }
}
