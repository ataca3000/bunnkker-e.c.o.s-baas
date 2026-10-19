<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Modules\Finance\Presentation\Http\Controllers\Concerns\ResolvesFinanceContext;
use Modules\Finance\Reporting\Domain\Models\ReportSnapshot;
use Modules\Finance\Reporting\Domain\Services\ExecutiveReportingService;

/**
 * Executive reporting — generate export-ready reports and manage their snapshots.
 * Reports derive entirely from existing Finance data; a snapshot is a read-model
 * archive, never a financial transaction.
 */
class ExecutiveReportingController extends Controller
{
    use ResolvesFinanceContext;

    private const TYPES = ['executive_summary', 'scorecard', 'monthly', 'quarterly', 'annual', 'kpi'];

    public function __construct(private readonly ExecutiveReportingService $service) {}

    public function generate(Request $request): JsonResponse
    {
        $validated = $request->validate(['type' => ['required', Rule::in(self::TYPES)]]);
        [$from, $to] = $this->financeWindow($request);

        return response()->json(['data' => $this->service->generate($this->companyId($request), $validated['type'], $from, $to)]);
    }

    public function snapshot(Request $request): JsonResponse
    {
        $validated = $request->validate(['type' => ['required', Rule::in(self::TYPES)]]);
        [$from, $to] = $this->financeWindow($request);

        $snapshot = $this->service->snapshot($this->companyId($request), $validated['type'], $from, $to, $this->actorId($request));

        return response()->json(['data' => ['id' => $snapshot->uuid, 'title' => $snapshot->title, 'generated_at' => $snapshot->generated_at?->toIso8601String()]], 201);
    }

    public function index(Request $request): JsonResponse
    {
        $snapshots = ReportSnapshot::query()
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('type'), fn ($q) => $q->where('report_type', $request->string('type')))
            ->latest('id')->limit(100)->get()
            ->map(fn (ReportSnapshot $s) => [
                'id' => $s->uuid,
                'report_type' => $s->report_type,
                'title' => $s->title,
                'period_from' => $s->period_from?->toDateString(),
                'period_to' => $s->period_to?->toDateString(),
                'generated_at' => $s->generated_at?->toIso8601String(),
            ]);

        return response()->json(['data' => $snapshots]);
    }

    public function show(Request $request, string $uuid): JsonResponse
    {
        $snapshot = ReportSnapshot::query()
            ->where('company_id', $this->companyId($request))
            ->where('uuid', $uuid)
            ->firstOrFail();

        return response()->json(['data' => ['id' => $snapshot->uuid, 'title' => $snapshot->title, 'payload' => $snapshot->payload]]);
    }
}
