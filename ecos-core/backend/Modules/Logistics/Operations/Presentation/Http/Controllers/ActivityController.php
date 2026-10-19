<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Logistics\Operations\Domain\Services\ActivityTimelineService;
use Modules\Logistics\Operations\Domain\Services\OperationalHistoryService;

/**
 * The activity timeline, the audit explorer and the three history views.
 *
 * Every endpoint reads append-only records other modules already keep. There is
 * no write path here, and a history that could be edited would not be a history.
 */
class ActivityController extends Controller
{
    public function __construct(
        private readonly ActivityTimelineService $timeline,
        private readonly OperationalHistoryService $history,
    ) {}

    public function options(): JsonResponse
    {
        return response()->json([
            'sources' => [
                ['value' => ActivityTimelineService::SOURCE_DISPATCH_TIMELINE, 'label' => 'Dispatch timeline'],
                ['value' => ActivityTimelineService::SOURCE_DISPATCH_AUDIT, 'label' => 'Dispatch audit'],
                ['value' => ActivityTimelineService::SOURCE_CAPACITY_AUDIT, 'label' => 'Capacity audit'],
                ['value' => ActivityTimelineService::SOURCE_ESCALATION, 'label' => 'Escalations'],
                ['value' => ActivityTimelineService::SOURCE_NOTE, 'label' => 'Notes'],
            ],
            'severities' => [
                ['value' => 'critical', 'label' => 'Critical'],
                ['value' => 'warning', 'label' => 'Warning'],
                ['value' => 'info', 'label' => 'Info'],
            ],
        ]);
    }

    /** The merged, time-ordered feed. */
    public function timeline(Request $request): JsonResponse
    {
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'source' => ['nullable', 'string'],
            'severity' => ['nullable', 'in:critical,warning,info'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:500'],
        ]);

        return response()->json([
            'data' => $this->timeline->feed([
                'company_id' => $this->companyId($request),
                'from' => $request->input('from'),
                'to' => $request->input('to'),
                'source' => $request->input('source'),
                'severity' => $request->input('severity'),
                'limit' => $request->integer('limit', 100),
            ]),
        ]);
    }

    /**
     * The audit explorer is the same feed narrowed to the two audit sources —
     * the record of who did what and why, without the operational chatter.
     */
    public function audit(Request $request): JsonResponse
    {
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:500'],
        ]);

        $dispatch = $this->timeline->feed([
            'company_id' => $this->companyId($request),
            'from' => $request->input('from'),
            'to' => $request->input('to'),
            'source' => ActivityTimelineService::SOURCE_DISPATCH_AUDIT,
            'limit' => $request->integer('limit', 100),
        ]);

        $capacity = $this->timeline->feed([
            'company_id' => $this->companyId($request),
            'from' => $request->input('from'),
            'to' => $request->input('to'),
            'source' => ActivityTimelineService::SOURCE_CAPACITY_AUDIT,
            'limit' => $request->integer('limit', 100),
        ]);

        $merged = array_merge($dispatch['items'], $capacity['items']);
        usort($merged, static fn (array $a, array $b) => [$b['occurred_at'], $b['id']] <=> [$a['occurred_at'], $a['id']]);

        return response()->json([
            'data' => [
                'items' => array_slice($merged, 0, $request->integer('limit', 100)),
                'available' => count($merged),
                'truncated_sources' => array_values(array_unique(array_merge(
                    $dispatch['truncated_sources'],
                    $capacity['truncated_sources'],
                ))),
            ],
        ]);
    }

    public function assignments(Request $request): JsonResponse
    {
        return response()->json($this->history->assignments(
            $this->historyFilters($request, ['status', 'mode']),
            (int) $request->integer('per_page', 25),
        ));
    }

    public function sessions(Request $request): JsonResponse
    {
        return response()->json($this->history->sessions(
            $this->historyFilters($request, ['status']),
            (int) $request->integer('per_page', 25),
        ));
    }

    public function capacity(Request $request): JsonResponse
    {
        return response()->json($this->history->capacity(
            $this->historyFilters($request, ['status']),
            (int) $request->integer('per_page', 25),
        ));
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /**
     * @param  list<string>  $extra
     * @return array<string, mixed>
     */
    private function historyFilters(Request $request, array $extra): array
    {
        $filters = [
            'company_id' => $this->companyId($request),
            'from' => $request->input('from'),
            'to' => $request->input('to'),
        ];

        foreach ($extra as $key) {
            $filters[$key] = $request->input($key);
        }

        return $filters;
    }

    private function companyId(Request $request): ?string
    {
        $companyId = $request->user()?->company_id;

        return $companyId === null ? null : (string) $companyId;
    }
}
