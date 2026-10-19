<?php

declare(strict_types=1);

namespace Modules\Marketing\Intelligence\Application\Actions;

use Illuminate\Http\Response;
use Modules\Marketing\Connections\Domain\Models\MarketingAuditLog;
use Modules\Marketing\Intelligence\Application\Dto\IntelligenceFilterDto;
use Modules\Marketing\Intelligence\Application\Services\MarketingKpiEngine;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

/**
 * Generates marketing intelligence reports in CSV, Excel (UTF-8 BOM CSV), or HTML format.
 *
 * CSV / Excel: streamed to the browser without writing to disk.
 * HTML: returned as a styled print-ready page (browser print → PDF).
 *
 * Note on Excel: we output a UTF-8 BOM CSV with .xlsx extension. Excel on Windows
 * opens UTF-8 BOM CSV files correctly. A real Excel package can be swapped in
 * (e.g. PhpSpreadsheet) without changing the interface.
 *
 * Note on PDF: HTML is returned. The browser's "Print → Save as PDF" workflow
 * produces a proper PDF. A headless Chrome or DomPDF integration can be added later.
 */
final class GenerateReportAction
{
    public function __construct(
        private readonly MarketingKpiEngine $engine,
    ) {}

    /**
     * Generate and stream a campaign analytics report.
     */
    public function campaignReport(
        IntelligenceFilterDto $filter,
        string $format = 'csv',
        string $sortBy = 'total_spend',
        ?string $actorId = null,
    ): StreamedResponse|Response {
        $breakdown = $this->engine->campaignBreakdown($filter, $sortBy, 'desc', null, 1000, 1);
        $rows = $breakdown['data'];

        $this->logReportGeneration('campaign', $format, $filter, count($rows), $actorId);

        return match ($format) {
            'excel' => $this->streamCsv($rows, $this->campaignHeaders(), 'campaign_analytics', excelMode: true),
            'html' => $this->htmlResponse($rows, $this->campaignHeaders(), 'Campaign Analytics Report', $filter),
            default => $this->streamCsv($rows, $this->campaignHeaders(), 'campaign_analytics'),
        };
    }

    /**
     * Generate and stream an ad analytics report.
     */
    public function adReport(
        IntelligenceFilterDto $filter,
        string $format = 'csv',
        ?string $actorId = null,
    ): StreamedResponse|Response {
        $breakdown = $this->engine->adBreakdown($filter, 'total_spend', 'desc', 1000, 1);
        $rows = $breakdown['data'];

        $this->logReportGeneration('ad', $format, $filter, count($rows), $actorId);

        return match ($format) {
            'excel' => $this->streamCsv($rows, $this->adHeaders(), 'ad_analytics', excelMode: true),
            'html' => $this->htmlResponse($rows, $this->adHeaders(), 'Ad Analytics Report', $filter),
            default => $this->streamCsv($rows, $this->adHeaders(), 'ad_analytics'),
        };
    }

    /**
     * Generate and stream a creative analytics report.
     */
    public function creativeReport(
        IntelligenceFilterDto $filter,
        string $format = 'csv',
        ?string $actorId = null,
    ): StreamedResponse|Response {
        $breakdown = $this->engine->creativeBreakdown($filter, 'total_revenue', 'desc', 1000, 1);
        $rows = $breakdown['data'];

        $this->logReportGeneration('creative', $format, $filter, count($rows), $actorId);

        return match ($format) {
            'excel' => $this->streamCsv($rows, $this->creativeHeaders(), 'creative_analytics', excelMode: true),
            'html' => $this->htmlResponse($rows, $this->creativeHeaders(), 'Creative Analytics Report', $filter),
            default => $this->streamCsv($rows, $this->creativeHeaders(), 'creative_analytics'),
        };
    }

    // ── CSV / Excel streaming ─────────────────────────────────────────────────

    /**
     * @param  list<array<string, mixed>>  $rows
     * @param  array<string, string>  $headers  [column_key => Column Label]
     */
    private function streamCsv(
        array $rows,
        array $headers,
        string $filename,
        bool $excelMode = false,
    ): StreamedResponse {
        $ext = $excelMode ? 'xlsx' : 'csv';
        $mime = $excelMode ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv';
        $date = now()->format('Y-m-d');
        $fullName = "{$filename}_{$date}.{$ext}";

        return response()->stream(function () use ($rows, $headers, $excelMode): void {
            $out = fopen('php://output', 'w');

            // Excel needs UTF-8 BOM to open CSV files correctly on Windows
            if ($excelMode) {
                fwrite($out, "\xEF\xBB\xBF");
            }

            fputcsv($out, array_values($headers));

            foreach ($rows as $row) {
                $line = [];
                foreach (array_keys($headers) as $key) {
                    $line[] = $row[$key] ?? '';
                }
                fputcsv($out, $line);
            }

            fclose($out);
        }, 200, [
            'Content-Type' => $mime,
            'Content-Disposition' => "attachment; filename=\"{$fullName}\"",
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
        ]);
    }

    // ── HTML report ───────────────────────────────────────────────────────────

    /**
     * @param  list<array<string, mixed>>  $rows
     * @param  array<string, string>  $headers
     */
    private function htmlResponse(
        array $rows,
        array $headers,
        string $title,
        IntelligenceFilterDto $filter,
    ): Response {
        [$start, $end] = $filter->resolvedDates();

        $html = $this->htmlHead($title);
        $html .= "<h1>{$title}</h1>";
        $html .= "<p class='meta'>Period: {$start} → {$end} | Generated: ".now()->format('Y-m-d H:i').' UTC</p>';
        $html .= '<table><thead><tr>';

        foreach ($headers as $label) {
            $html .= "<th>{$label}</th>";
        }

        $html .= '</tr></thead><tbody>';

        foreach ($rows as $row) {
            $html .= '<tr>';
            foreach (array_keys($headers) as $key) {
                $val = $row[$key] ?? '—';
                $html .= '<td>'.htmlspecialchars((string) $val, ENT_QUOTES, 'UTF-8').'</td>';
            }
            $html .= '</tr>';
        }

        $html .= '</tbody></table></body></html>';

        $date = now()->format('Y-m-d');
        $filename = strtolower(str_replace(' ', '_', $title))."_{$date}.html";

        return response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }

    private function htmlHead(string $title): string
    {
        return <<<HTML
        <!DOCTYPE html>
        <html lang="en">
        <head>
        <meta charset="UTF-8">
        <title>{$title}</title>
        <style>
            body { font-family: Arial, sans-serif; font-size: 11px; color: #222; }
            h1 { font-size: 16px; margin-bottom: 4px; }
            .meta { color: #666; font-size: 10px; margin-bottom: 12px; }
            table { border-collapse: collapse; width: 100%; }
            th { background: #1a1a2e; color: #fff; text-align: left; padding: 6px 8px; font-size: 10px; }
            td { padding: 5px 8px; border-bottom: 1px solid #eee; }
            tr:nth-child(even) td { background: #f9f9f9; }
            @media print {
                body { font-size: 9px; }
                th, td { padding: 3px 5px; }
            }
        </style>
        </head>
        <body>
        HTML;
    }

    // ── Column definitions ────────────────────────────────────────────────────

    /** @return array<string, string> */
    private function campaignHeaders(): array
    {
        return [
            'rank' => 'Rank',
            'name' => 'Campaign',
            'status' => 'Status',
            'objective' => 'Objective',
            'spend' => 'Spend',
            'revenue' => 'Revenue',
            'roas' => 'ROAS',
            'roi' => 'ROI %',
            'purchases' => 'Purchases',
            'leads' => 'Leads',
            'ctr' => 'CTR',
            'cpa' => 'CPA',
            'cpc' => 'CPC',
            'cpm' => 'CPM',
            'impressions' => 'Impressions',
            'clicks' => 'Clicks',
            'reach' => 'Reach',
        ];
    }

    /** @return array<string, string> */
    private function adHeaders(): array
    {
        return [
            'rank' => 'Rank',
            'name' => 'Ad',
            'status' => 'Status',
            'campaign_name' => 'Campaign',
            'spend' => 'Spend',
            'revenue' => 'Revenue',
            'roas' => 'ROAS',
            'roi' => 'ROI %',
            'purchases' => 'Purchases',
            'leads' => 'Leads',
            'ctr' => 'CTR',
            'cpa' => 'CPA',
            'cpc' => 'CPC',
            'cpm' => 'CPM',
            'impressions' => 'Impressions',
            'clicks' => 'Clicks',
        ];
    }

    /** @return array<string, string> */
    private function creativeHeaders(): array
    {
        return [
            'rank' => 'Rank',
            'headline' => 'Headline',
            'creative_type' => 'Type',
            'campaign_name' => 'Campaign',
            'spend' => 'Spend',
            'revenue' => 'Revenue',
            'roas' => 'ROAS',
            'cpa' => 'CPA',
            'ctr' => 'CTR',
            'purchases' => 'Purchases',
            'impressions' => 'Impressions',
            'clicks' => 'Clicks',
        ];
    }

    // ── Audit ─────────────────────────────────────────────────────────────────

    private function logReportGeneration(
        string $reportType,
        string $format,
        IntelligenceFilterDto $filter,
        int $rowCount,
        ?string $actorId,
    ): void {
        try {
            MarketingAuditLog::record(
                entityType: 'marketing_report',
                entityId: uniqid('report_', true),
                action: 'report_generated',
                actorId: $actorId,
                after: [
                    'report_type' => $reportType,
                    'format' => $format,
                    'row_count' => $rowCount,
                    'date_preset' => $filter->datePreset,
                    'date_start' => $filter->dateStart,
                    'date_stop' => $filter->dateStop,
                    'company_id' => $filter->companyId,
                ],
                connectionId: $filter->connectionId,
            );
        } catch (Throwable) {
            // Audit failures never block report delivery
        }
    }
}
