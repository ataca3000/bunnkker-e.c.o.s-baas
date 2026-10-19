<?php

declare(strict_types=1);

namespace Modules\Marketing\Intelligence\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\Intelligence\Application\Actions\GenerateReportAction;
use Modules\Marketing\Intelligence\Application\Dto\IntelligenceFilterDto;
use Modules\Marketing\Intelligence\Domain\Models\MarketingReport;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Marketing Report Controller.
 *
 * Provides both:
 * 1. Inline streaming exports (fast, no DB record)
 *    GET /marketing/intelligence/reports/export/campaigns
 *    GET /marketing/intelligence/reports/export/ads
 *    GET /marketing/intelligence/reports/export/creatives
 *
 * 2. Tracked report history
 *    GET /marketing/intelligence/reports
 *    GET /marketing/intelligence/reports/{id}
 *
 * Format param:  ?format=csv | excel | html  (default: csv)
 * All IntelligenceFilterDto params apply to report scope.
 */
final class MarketingReportController extends Controller
{
    public function __construct(
        private readonly GenerateReportAction $generateReport,
    ) {}

    // ── Inline streaming exports ──────────────────────────────────────────────

    public function exportCampaigns(Request $request): StreamedResponse|\Illuminate\Http\Response
    {
        $filter = IntelligenceFilterDto::fromRequest($request);
        $format = $this->validFormat($request->query('format', 'csv'));
        $sortBy = $request->query('sort_by', 'total_spend');
        $actorId = $request->user()?->id;

        return $this->generateReport->campaignReport($filter, $format, $sortBy, $actorId);
    }

    public function exportAds(Request $request): StreamedResponse|\Illuminate\Http\Response
    {
        $filter = IntelligenceFilterDto::fromRequest($request);
        $format = $this->validFormat($request->query('format', 'csv'));
        $actorId = $request->user()?->id;

        return $this->generateReport->adReport($filter, $format, $actorId);
    }

    public function exportCreatives(Request $request): StreamedResponse|\Illuminate\Http\Response
    {
        $filter = IntelligenceFilterDto::fromRequest($request);
        $format = $this->validFormat($request->query('format', 'csv'));
        $actorId = $request->user()?->id;

        return $this->generateReport->creativeReport($filter, $format, $actorId);
    }

    // ── Report history ────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $query = MarketingReport::query()
            ->when($request->query('company_id'), fn ($q, $v) => $q->where('company_id', $v))
            ->when($request->user()?->id, fn ($q, $v) => $q->where('generated_by', $v))
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($query);
    }

    public function show(MarketingReport $report): JsonResponse
    {
        return response()->json([
            'id' => $report->id,
            'type' => $report->type,
            'status' => $report->status,
            'report_name' => $report->report_name,
            'filters' => $report->filters,
            'row_count' => $report->row_count,
            'generated_at' => $report->generated_at?->toIso8601String(),
            'expires_at' => $report->expires_at?->toIso8601String(),
            'is_expired' => $report->isExpired(),
        ]);
    }

    private function validFormat(string $value): string
    {
        return in_array($value, ['csv', 'excel', 'html'], true) ? $value : 'csv';
    }
}
