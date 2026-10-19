<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Presentation\Http\Controllers;

use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Core\BusinessAttribution\Application\Actions\ResolveEntityAtTimeAction;
use Modules\Core\BusinessAttribution\Application\Services\TimeMachineService;
use Modules\Core\BusinessAttribution\Domain\ValueObjects\TimestampContext;
use Modules\Core\BusinessAttribution\Presentation\Http\Resources\EntityStateResource;

class TimeMachineController
{
    public function __construct(
        private readonly TimeMachineService $timeMachine,
        private readonly ResolveEntityAtTimeAction $resolveAction,
    ) {}

    /**
     * Reconstruct entity state at a specific point in time.
     * GET /bae/time-machine/{entityType}/{entityId}?at=2026-07-01T12:00:00Z
     */
    public function resolveAt(Request $request, string $entityType, string $entityId): JsonResponse
    {
        $validated = $request->validate([
            'at' => ['required', 'date'],
        ]);

        $state = $this->resolveAction->execute(
            entityType: $entityType,
            entityId: $entityId,
            asOf: Carbon::parse($validated['at']),
            purpose: (string) $request->query('purpose', 'Time Machine Query'),
            userId: $request->user()?->id,
        );

        return response()->json(new EntityStateResource($state));
    }

    /**
     * Full historical view: state + temporal metadata.
     * GET /bae/time-machine/{entityType}/{entityId}/view?at=...
     */
    public function historicalView(Request $request, string $entityType, string $entityId): JsonResponse
    {
        $validated = $request->validate([
            'at' => ['required', 'date'],
        ]);

        $view = $this->timeMachine->getHistoricalView(
            $entityType,
            $entityId,
            Carbon::parse($validated['at']),
        );

        return response()->json(['data' => $view]);
    }

    /**
     * Field-level diff between two timestamps.
     * GET /bae/time-machine/{entityType}/{entityId}/diff?from=...&to=...
     */
    public function diff(Request $request, string $entityType, string $entityId): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after:from'],
        ]);

        $diff = $this->timeMachine->diff(
            $entityType,
            $entityId,
            Carbon::parse($validated['from']),
            Carbon::parse($validated['to']),
        );

        return response()->json(['data' => $diff]);
    }

    /**
     * Return a TimestampContext descriptor for a given moment.
     * GET /bae/time-machine/context?at=...
     */
    public function context(Request $request): JsonResponse
    {
        $at = $request->query('at') ? Carbon::parse($request->query('at')) : Carbon::now();
        $context = TimestampContext::at($at);

        return response()->json(['data' => $context->toArray()]);
    }
}
