<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Modules\Finance\Fiscal\Domain\Enums\PeriodStatus;
use Modules\Finance\Fiscal\Domain\Models\FiscalPeriod;
use Modules\Finance\Fiscal\Domain\Models\FiscalYear;
use Modules\Finance\Fiscal\Domain\Services\FiscalCalendarService;

class FiscalController extends Controller
{
    public function __construct(private readonly FiscalCalendarService $calendar) {}

    public function options(): JsonResponse
    {
        return response()->json(['period_statuses' => PeriodStatus::values()]);
    }

    public function index(Request $request): JsonResponse
    {
        $years = FiscalYear::query()
            ->where('company_id', $this->companyId($request))
            ->with('periods')
            ->orderByDesc('start_date')
            ->get()
            ->map(fn (FiscalYear $y) => [
                'id' => $y->uuid,
                'name' => $y->name,
                'status' => $y->status->value,
                'start_date' => $y->start_date?->toDateString(),
                'end_date' => $y->end_date?->toDateString(),
                'periods' => $y->periods->sortBy('period_number')->values()->map(fn (FiscalPeriod $p) => [
                    'id' => $p->uuid,
                    'period_number' => $p->period_number,
                    'name' => $p->name,
                    'status' => $p->status->value,
                    'start_date' => $p->start_date?->toDateString(),
                    'end_date' => $p->end_date?->toDateString(),
                ]),
            ]);

        return response()->json(['data' => $years]);
    }

    public function createYear(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:40'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after:start_date'],
            'period_count' => ['nullable', 'integer', 'min:1', 'max:13'],
        ]);

        $year = $this->calendar->createYear(
            $this->companyId($request),
            $validated['name'],
            Carbon::parse($validated['start_date']),
            Carbon::parse($validated['end_date']),
            $request->user()?->id,
            (int) ($validated['period_count'] ?? 12),
        );

        return response()->json(['data' => ['id' => $year->uuid, 'name' => $year->name]], 201);
    }

    public function openPeriod(Request $request, string $uuid): JsonResponse
    {
        $period = $this->calendar->openPeriod($this->period($request, $uuid));

        return response()->json(['data' => $this->periodPayload($period)]);
    }

    public function closePeriod(Request $request, string $uuid): JsonResponse
    {
        $period = $this->calendar->closePeriod($this->period($request, $uuid), $request->user()?->id);

        return response()->json(['data' => $this->periodPayload($period)]);
    }

    public function lockPeriod(Request $request, string $uuid): JsonResponse
    {
        $period = $this->calendar->lockPeriod($this->period($request, $uuid), $request->user()?->id);

        return response()->json(['data' => $this->periodPayload($period)]);
    }

    private function period(Request $request, string $uuid): FiscalPeriod
    {
        return FiscalPeriod::query()
            ->where('company_id', $this->companyId($request))
            ->where('uuid', $uuid)
            ->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function periodPayload(FiscalPeriod $p): array
    {
        return [
            'id' => $p->uuid,
            'name' => $p->name,
            'status' => $p->status->value,
            'accepts_postings' => $p->acceptsPostings(),
        ];
    }

    private function companyId(Request $request): string
    {
        return (string) $request->user()->company_id;
    }
}
