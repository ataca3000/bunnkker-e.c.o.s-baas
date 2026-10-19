<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Hr\Compensation\Domain\Models\KpiFact;
use Modules\Hr\Compensation\Domain\Services\KpiFactService;
use Modules\Hr\Workforce\Presentation\Http\Controllers\Concerns\ResolvesHrContext;

/**
 * The KPI ingest endpoint.
 *
 * The push route for operational modules and jobs that do not go through the
 * event bus. Idempotent on the key, so retrying a batch is always safe.
 */
class KpiFactController extends Controller
{
    use ResolvesHrContext;

    public function __construct(private readonly KpiFactService $facts) {}

    public function index(Request $request): JsonResponse
    {
        $rows = KpiFact::query()
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('employee_id'), fn ($q) => $q->where('employee_id', $request->string('employee_id')))
            ->when($request->filled('metric_key'), fn ($q) => $q->where('metric_key', $request->string('metric_key')))
            ->orderByDesc('occurred_at')->limit(200)->get()
            ->map(fn (KpiFact $f) => [
                'id' => (string) $f->id,
                'employee_id' => $f->employee_id,
                'department_id' => $f->department_id,
                'source_module' => $f->source_module,
                'metric_key' => $f->metric_key,
                'value' => round((float) $f->value, 4),
                'quantity' => round((float) $f->quantity, 4),
                'dimension_key' => $f->dimension_key,
                'dimension_value' => $f->dimension_value,
                'occurred_at' => $f->occurred_at?->toDateTimeString(),
                'source_reference' => $f->source_reference,
            ]);

        return response()->json(['data' => $rows]);
    }

    /** Record one fact. */
    public function store(Request $request): JsonResponse
    {
        $v = $request->validate($this->factRules());

        $event = $this->facts->eventFromPayload($this->companyId($request), $v);

        if ($event === null) {
            return response()->json(['message' => 'Unknown metric key.'], 422);
        }

        return response()->json(['data' => $this->facts->record($event)], 201);
    }

    /** Record a batch, reporting how many were new and how many were already known. */
    public function storeMany(Request $request): JsonResponse
    {
        $v = $request->validate([
            'facts' => ['required', 'array', 'min:1', 'max:1000'],
            'facts.*.metric_key' => ['required', 'string', 'max:60'],
            'facts.*.employee_id' => ['nullable', 'string'],
            'facts.*.department_id' => ['nullable', 'string'],
            'facts.*.value' => ['nullable', 'numeric'],
            'facts.*.quantity' => ['nullable', 'numeric'],
            'facts.*.occurred_at' => ['nullable', 'date'],
            'facts.*.source_reference' => ['nullable', 'string', 'max:64'],
            'facts.*.idempotency_key' => ['nullable', 'string', 'max:160'],
            'facts.*.dimension_key' => ['nullable', 'string', 'max:40'],
            'facts.*.dimension_value' => ['nullable', 'string', 'max:64'],
        ]);

        $companyId = $this->companyId($request);
        $events = [];
        $rejected = 0;

        foreach ($v['facts'] as $payload) {
            $event = $this->facts->eventFromPayload($companyId, $payload);
            $event === null ? $rejected++ : $events[] = $event;
        }

        return response()->json(['data' => $this->facts->recordMany($events) + ['rejected' => $rejected]]);
    }

    /** @return array<string, mixed> */
    private function factRules(): array
    {
        return [
            'metric_key' => ['required', 'string', 'max:60'],
            'employee_id' => ['nullable', 'string'],
            'department_id' => ['nullable', 'string'],
            'value' => ['nullable', 'numeric'],
            'quantity' => ['nullable', 'numeric'],
            'occurred_at' => ['nullable', 'date'],
            'source_reference' => ['nullable', 'string', 'max:64'],
            'idempotency_key' => ['nullable', 'string', 'max:160'],
            'dimension_key' => ['nullable', 'string', 'max:40'],
            'dimension_value' => ['nullable', 'string', 'max:64'],
            'metadata' => ['nullable', 'array'],
        ];
    }
}
