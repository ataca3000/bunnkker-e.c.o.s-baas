<?php

declare(strict_types=1);

namespace Modules\Crm\Executive\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\Crm\Executive\Domain\Support\ExecutivePeriod;
use Modules\Crm\Executive\Domain\Support\ExecutiveThresholds;
use Modules\Crm\Executive\Domain\Support\Metric;

/**
 * Customer satisfaction — CSAT and NPS, both derived from the rating a customer
 * leaves on a service case (`crm_service_tickets.satisfaction_rating`, 1..5).
 *
 * ┌─ ONE RATING · TWO STANDARD MEASURES · STATED MAPPING ───────────────────┐
 * │ CSAT is the share of responses at or above the "satisfied" threshold. NPS  │
 * │ uses the standard 5-point mapping — 5 promotes, 4 is passive, 1..3 detracts │
 * │ — and is reported on the conventional -100..+100 scale. The mapping is      │
 * │ returned with the numbers so nobody has to guess how a score was reached.   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class SatisfactionService
{
    /** @return array<string, mixed> */
    public function forPeriod(string $companyId, ExecutivePeriod $period): array
    {
        $current = $this->measure($companyId, $period);
        $previous = $this->measure($companyId, $period->previous());

        return [
            'responses' => $current['responses'],
            'response_rate_percent' => $this->responseRate($companyId, $period),
            'csat_percent' => Metric::compare($current['csat'], $previous['csat']),
            'average_rating' => Metric::compare($current['average_rating'], $previous['average_rating']),
            'nps' => Metric::compare($current['nps'], $previous['nps'], 0),
            'promoters' => $current['promoters'],
            'passives' => $current['passives'],
            'detractors' => $current['detractors'],
            'policy' => ExecutiveThresholds::satisfactionPolicy(),
        ];
    }

    /** @return array<string, float|int> */
    private function measure(string $companyId, ExecutivePeriod $period): array
    {
        $satisfied = ExecutiveThresholds::CSAT_SATISFIED_MIN;
        $promoter = ExecutiveThresholds::NPS_PROMOTER_MIN;
        $detractor = ExecutiveThresholds::NPS_DETRACTOR_MAX;

        $row = DB::table('crm_service_tickets')
            ->where('company_id', $companyId)
            ->whereNotNull('satisfaction_rating')
            ->whereBetween('created_at', [$period->start, $period->end])
            ->selectRaw(
                'count(*) as responses,'
                .' avg(satisfaction_rating) as average_rating,'
                ." sum(case when satisfaction_rating >= {$satisfied} then 1 else 0 end) as satisfied,"
                ." sum(case when satisfaction_rating >= {$promoter} then 1 else 0 end) as promoters,"
                ." sum(case when satisfaction_rating <= {$detractor} then 1 else 0 end) as detractors"
            )->first();

        $responses = (int) ($row->responses ?? 0);
        if ($responses === 0) {
            return ['responses' => 0, 'average_rating' => 0.0, 'csat' => 0.0, 'nps' => 0, 'promoters' => 0, 'passives' => 0, 'detractors' => 0];
        }

        $promoters = (int) $row->promoters;
        $detractors = (int) $row->detractors;

        return [
            'responses' => $responses,
            'average_rating' => round((float) $row->average_rating, 2),
            'csat' => Metric::rate((int) $row->satisfied, $responses),
            // NPS = % promoters − % detractors, on the conventional -100..+100 scale.
            'nps' => (int) round(Metric::rate($promoters, $responses) - Metric::rate($detractors, $responses)),
            'promoters' => $promoters,
            'passives' => $responses - $promoters - $detractors,
            'detractors' => $detractors,
        ];
    }

    /** What share of the period's cases came back with a rating at all. */
    private function responseRate(string $companyId, ExecutivePeriod $period): float
    {
        $tickets = DB::table('crm_service_tickets')
            ->where('company_id', $companyId)
            ->whereBetween('created_at', [$period->start, $period->end])
            ->selectRaw('count(*) as total, sum(case when satisfaction_rating is null then 0 else 1 end) as rated')
            ->first();

        return Metric::rate((int) ($tickets->rated ?? 0), (int) ($tickets->total ?? 0));
    }
}
