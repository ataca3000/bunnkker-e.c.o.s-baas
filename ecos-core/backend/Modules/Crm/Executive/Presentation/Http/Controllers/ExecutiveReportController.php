<?php

declare(strict_types=1);

namespace Modules\Crm\Executive\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Modules\Crm\Executive\Domain\Services\ExecutiveReportService;
use Modules\Crm\Executive\Presentation\Http\Controllers\Concerns\ResolvesExecutivePeriod;

/**
 * Executive reports — monthly, quarterly, annual and export-ready.
 *
 * Reports are generated on request from the same read-only services the dashboard
 * uses; nothing is written, so re-running a period always reproduces it.
 */
class ExecutiveReportController extends Controller
{
    use ResolvesExecutivePeriod;

    public function __construct(private readonly ExecutiveReportService $reports) {}

    public function monthly(Request $request): JsonResponse
    {
        $now = Carbon::now();
        $report = $this->reports->monthly(
            $this->companyId($request),
            (int) $request->integer('year', (int) $now->year),
            (int) $request->integer('month', (int) $now->month),
        );

        return response()->json(['data' => $report]);
    }

    public function quarterly(Request $request): JsonResponse
    {
        $now = Carbon::now();
        $report = $this->reports->quarterly(
            $this->companyId($request),
            (int) $request->integer('year', (int) $now->year),
            (int) $request->integer('quarter', (int) ceil((int) $now->month / 3)),
        );

        return response()->json(['data' => $report]);
    }

    public function annual(Request $request): JsonResponse
    {
        $report = $this->reports->annual(
            $this->companyId($request),
            (int) $request->integer('year', (int) Carbon::now()->year),
        );

        return response()->json(['data' => $report]);
    }

    /** Any window, resolved from the request. */
    public function generate(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->reports->forPeriod($this->companyId($request), $this->period($request))]);
    }

    /** The same report flattened into export-ready rows. */
    public function export(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->reports->export($this->companyId($request), $this->period($request))]);
    }
}
