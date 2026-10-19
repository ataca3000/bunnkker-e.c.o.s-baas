<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Hr\Recruitment\Domain\Enums\ApplicationStatus;
use Modules\Hr\Recruitment\Domain\Enums\JobOpeningStatus;
use Modules\Hr\Recruitment\Domain\Enums\OfferStatus;

/**
 * Recruitment analytics.
 *
 * ┌─ READ-ONLY, LIKE H6 ────────────────────────────────────────────────────┐
 * │ No writes, no models, no tables of its own. Every figure is counted from    │
 * │ what the pipeline already recorded, so a number here can never disagree      │
 * │ with the candidacy it came from — there is no second copy to drift.          │
 * │                                                                            │
 * │ Rates are reported with their NUMERATOR AND DENOMINATOR, never as a bare     │
 * │ percentage. "Offer rate 40%" out of five applications is noise, and a        │
 * │ figure that cannot show its own sample size will eventually be presented     │
 * │ to a board as if it could.                                                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Timestamp arithmetic is done in PHP, and conditional counts use CASE WHEN, so
 * the whole service runs unchanged on MySQL and PostgreSQL.
 */
final class RecruitmentAnalyticsService
{
    /** Trend charts stop here; beyond a year of months a chart is a wall. */
    private const MAX_BUCKETS = 12;

    /**
     * Everything the analytics page shows.
     *
     * @return array<string, mixed>
     */
    public function dashboard(string $companyId, ?string $from = null, ?string $to = null): array
    {
        [$start, $end] = $this->window($from, $to);

        return [
            'period' => [
                'from' => $start->toDateString(),
                'to' => $end->toDateString(),
                'days' => (int) $start->diffInDays($end) + 1,
            ],
            'kpis' => $this->kpis($companyId, $start, $end),
            'funnel' => $this->funnel($companyId, $start, $end),
            'monthly_hiring' => $this->monthlyHiring($companyId, $end),
            'trend' => $this->applicationTrend($companyId, $end),
            'hiring_by_department' => $this->hiringByDepartment($companyId, $start, $end),
            'source_effectiveness' => $this->sourceEffectiveness($companyId, $start, $end),
            'recruiter_performance' => $this->recruiterPerformance($companyId, $start, $end),
            'time_in_stage' => $this->averageTimeInStage($companyId, $start, $end),
        ];
    }

    // ── KPIs ──────────────────────────────────────────────────────────────────

    /** @return array<string, mixed> */
    public function kpis(string $companyId, Carbon $start, Carbon $end): array
    {
        $openJobs = DB::table('hr_job_openings')
            ->where('company_id', $companyId)
            ->whereIn('status', [JobOpeningStatus::Published->value, JobOpeningStatus::Draft->value])
            ->count();

        $counts = $this->applicationCounts($companyId, $start, $end);
        $applications = (int) $counts['total'];

        $jobsReceiving = DB::table('hr_job_applications')
            ->where('company_id', $companyId)
            ->whereBetween('applied_at', [$start, $end])
            ->distinct()->count('job_opening_id');

        $interviewed = DB::table('hr_interviews as i')
            ->join('hr_job_applications as a', 'a.id', '=', 'i.application_id')
            ->where('a.company_id', $companyId)
            ->whereBetween('a.applied_at', [$start, $end])
            ->distinct()->count('i.application_id');

        $offered = (int) $counts['offered'];
        $accepted = (int) $counts['accepted'];
        $hired = (int) $counts['hired'];

        return [
            'open_jobs' => $openJobs,
            'applications' => $applications,
            'applicants_per_job' => $this->ratio($applications, $jobsReceiving, 'applications', 'jobs receiving applications'),

            // Each rate names what it divided, so nobody reads 100% off two candidates.
            'interview_rate' => $this->rate($interviewed, $applications, 'applications reaching an interview'),
            'offer_rate' => $this->rate($offered, $applications, 'applications receiving an offer'),
            'acceptance_rate' => $this->rate($accepted, $offered, 'offers accepted'),
            'hiring_rate' => $this->rate($hired, $applications, 'applications ending in a hire'),

            'average_time_to_hire' => $this->averageTimeToHire($companyId, $start, $end),
        ];
    }

    /**
     * Days from application to hire, averaged.
     *
     * Measured from the applicant's side — the clock starts when they applied, not
     * when someone got round to opening it.
     *
     * @return array<string, mixed>
     */
    public function averageTimeToHire(string $companyId, Carbon $start, Carbon $end): array
    {
        $rows = DB::table('hr_job_applications')
            ->where('company_id', $companyId)
            ->where('status', ApplicationStatus::OfferAccepted->value)
            ->whereNotNull('decided_at')
            ->whereBetween('decided_at', [$start, $end])
            ->get(['applied_at', 'decided_at']);

        // Subtraction in PHP rather than SQL — DATEDIFF and EXTRACT(EPOCH …) are
        // not the same function on both databases.
        $spans = $rows
            ->map(function (object $row): ?float {
                if ($row->applied_at === null || $row->decided_at === null) {
                    return null;
                }

                return (float) Carbon::parse($row->applied_at)
                    ->diffInDays(Carbon::parse($row->decided_at), false);
            })
            ->filter(fn (?float $d) => $d !== null && $d >= 0)
            ->values();

        return [
            'days' => $spans->isEmpty() ? null : round($spans->avg(), 1),
            'fastest_days' => $spans->isEmpty() ? null : round((float) $spans->min(), 1),
            'slowest_days' => $spans->isEmpty() ? null : round((float) $spans->max(), 1),
            'hires_measured' => $spans->count(),
        ];
    }

    /**
     * How long candidacies sit in each stage.
     *
     * Read from the append-only stage log: the gap between one move and the next
     * IS the time spent, and no other table knows it.
     *
     * @return array<int, array<string, mixed>>
     */
    public function averageTimeInStage(string $companyId, Carbon $start, Carbon $end): array
    {
        $events = DB::table('hr_application_stage_events as e')
            ->join('hr_job_applications as a', 'a.id', '=', 'e.application_id')
            ->where('e.company_id', $companyId)
            ->whereBetween('a.applied_at', [$start, $end])
            ->orderBy('e.application_id')
            ->orderBy('e.occurred_at')
            ->get(['e.application_id', 'e.to_stage_id', 'e.occurred_at']);

        $durations = [];

        foreach ($events->groupBy('application_id') as $sequence) {
            $ordered = $sequence->values();

            for ($i = 0; $i < $ordered->count() - 1; $i++) {
                $stageId = $ordered[$i]->to_stage_id;

                if ($stageId === null) {
                    continue;
                }

                $days = Carbon::parse($ordered[$i]->occurred_at)
                    ->diffInDays(Carbon::parse($ordered[$i + 1]->occurred_at), false);

                if ($days < 0) {
                    continue;
                }

                $durations[$stageId][] = (float) $days;
            }
        }

        $stages = DB::table('hr_recruitment_stages')
            ->where('company_id', $companyId)
            ->orderBy('sequence')
            ->get(['id', 'name', 'sequence']);

        return $stages->map(function (object $stage) use ($durations): array {
            $samples = $durations[$stage->id] ?? [];

            return [
                'stage_id' => (string) $stage->id,
                'stage_name' => $stage->name,
                'sequence' => (int) $stage->sequence,
                'average_days' => $samples === [] ? null : round(array_sum($samples) / count($samples), 1),
                'candidacies_measured' => count($samples),
            ];
        })->all();
    }

    // ── Charts ────────────────────────────────────────────────────────────────

    /**
     * Funnel conversion — how many survive each step, and what share of the step
     * before them that is.
     *
     * @return array<int, array<string, mixed>>
     */
    public function funnel(string $companyId, Carbon $start, Carbon $end): array
    {
        $counts = $this->applicationCounts($companyId, $start, $end);

        $interviewed = DB::table('hr_interviews as i')
            ->join('hr_job_applications as a', 'a.id', '=', 'i.application_id')
            ->where('a.company_id', $companyId)
            ->whereBetween('a.applied_at', [$start, $end])
            ->distinct()->count('i.application_id');

        $steps = [
            ['key' => 'applied', 'label' => 'Applied', 'count' => (int) $counts['total']],
            ['key' => 'interviewed', 'label' => 'Interviewed', 'count' => $interviewed],
            ['key' => 'offered', 'label' => 'Offered', 'count' => (int) $counts['offered']],
            ['key' => 'accepted', 'label' => 'Accepted', 'count' => (int) $counts['accepted']],
            ['key' => 'hired', 'label' => 'Hired', 'count' => (int) $counts['hired']],
        ];

        $top = $steps[0]['count'];
        $previous = null;

        foreach ($steps as $index => $step) {
            $steps[$index]['share_of_total'] = $top > 0 ? round(($step['count'] / $top) * 100, 1) : 0.0;
            $steps[$index]['conversion_from_previous'] = $previous === null || $previous === 0
                ? null
                : round(($step['count'] / $previous) * 100, 1);
            // Where the pipeline actually loses people — the number worth acting on.
            $steps[$index]['dropped_from_previous'] = $previous === null ? null : max(0, $previous - $step['count']);
            $previous = $step['count'];
        }

        return $steps;
    }

    /**
     * Hires per month.
     *
     * @return array<int, array<string, mixed>>
     */
    public function monthlyHiring(string $companyId, Carbon $end, int $months = self::MAX_BUCKETS): array
    {
        $buckets = $this->months($end, $months);

        $rows = DB::table('hr_job_applications')
            ->where('company_id', $companyId)
            ->where('status', ApplicationStatus::OfferAccepted->value)
            ->whereNotNull('decided_at')
            ->where('decided_at', '>=', $this->firstBucketStart($end, $months))
            ->get(['decided_at']);

        foreach ($rows as $row) {
            $key = Carbon::parse($row->decided_at)->format('Y-m');

            if (isset($buckets[$key])) {
                $buckets[$key]['hires']++;
            }
        }

        return array_values($buckets);
    }

    /**
     * Applications per month — the top of the funnel over time.
     *
     * @return array<int, array<string, mixed>>
     */
    public function applicationTrend(string $companyId, Carbon $end, int $months = self::MAX_BUCKETS): array
    {
        $buckets = $this->months($end, $months);

        $rows = DB::table('hr_job_applications')
            ->where('company_id', $companyId)
            ->where('applied_at', '>=', $this->firstBucketStart($end, $months))
            ->get(['applied_at', 'status']);

        foreach ($rows as $row) {
            $key = Carbon::parse($row->applied_at)->format('Y-m');

            if (! isset($buckets[$key])) {
                continue;
            }

            $buckets[$key]['applications']++;

            if ($row->status === ApplicationStatus::OfferAccepted->value) {
                $buckets[$key]['hires']++;
            }
        }

        return array_values($buckets);
    }

    /**
     * Hires by department.
     *
     * @return array<int, array<string, mixed>>
     */
    public function hiringByDepartment(string $companyId, Carbon $start, Carbon $end): array
    {
        return DB::table('hr_job_applications as a')
            ->join('hr_job_openings as o', 'o.id', '=', 'a.job_opening_id')
            ->leftJoin('hr_departments as d', 'd.id', '=', 'o.department_id')
            ->where('a.company_id', $companyId)
            ->whereBetween('a.applied_at', [$start, $end])
            ->groupBy('d.id', 'd.name')
            ->selectRaw('d.id as department_id, d.name as department_name, COUNT(*) as applications')
            // CASE WHEN, not IF() — the latter does not exist on PostgreSQL.
            ->selectRaw('SUM(CASE WHEN a.status = ? THEN 1 ELSE 0 END) as hires', [ApplicationStatus::OfferAccepted->value])
            ->orderByDesc('applications')
            ->get()
            ->map(fn (object $row) => [
                'department_id' => $row->department_id === null ? null : (string) $row->department_id,
                'department_name' => $row->department_name ?? 'Unassigned',
                'applications' => (int) $row->applications,
                'hires' => (int) $row->hires,
                'hire_rate' => (int) $row->applications > 0
                    ? round(((int) $row->hires / (int) $row->applications) * 100, 1)
                    : 0.0,
            ])->all();
    }

    /**
     * Which channels actually produce hires, not just volume.
     *
     * A source that sends four hundred applications and no hires is a cost, and
     * only this comparison shows it.
     *
     * @return array<int, array<string, mixed>>
     */
    public function sourceEffectiveness(string $companyId, Carbon $start, Carbon $end): array
    {
        return DB::table('hr_job_applications')
            ->where('company_id', $companyId)
            ->whereBetween('applied_at', [$start, $end])
            ->groupBy('source')
            ->selectRaw('source, COUNT(*) as applications')
            ->selectRaw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as hires', [ApplicationStatus::OfferAccepted->value])
            ->selectRaw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as rejected', [ApplicationStatus::Rejected->value])
            ->orderByDesc('applications')
            ->get()
            ->map(fn (object $row) => [
                'source' => $row->source ?? 'unknown',
                'applications' => (int) $row->applications,
                'hires' => (int) $row->hires,
                'rejected' => (int) $row->rejected,
                'hire_rate' => (int) $row->applications > 0
                    ? round(((int) $row->hires / (int) $row->applications) * 100, 1)
                    : 0.0,
            ])->all();
    }

    /**
     * Recruiter performance.
     *
     * Counted from candidacies and joined back to Workforce for the name — HR keeps
     * no copy of who a recruiter is.
     *
     * @return array<int, array<string, mixed>>
     */
    public function recruiterPerformance(string $companyId, Carbon $start, Carbon $end): array
    {
        return DB::table('hr_job_applications as a')
            ->join('hr_employees as e', 'e.id', '=', 'a.recruiter_employee_id')
            ->where('a.company_id', $companyId)
            ->whereNotNull('a.recruiter_employee_id')
            ->whereBetween('a.applied_at', [$start, $end])
            ->groupBy('e.id', 'e.employee_number', 'e.first_name', 'e.last_name')
            ->selectRaw('e.id as employee_id, e.employee_number, e.first_name, e.last_name, COUNT(*) as assigned')
            ->selectRaw('SUM(CASE WHEN a.status = ? THEN 1 ELSE 0 END) as hires', [ApplicationStatus::OfferAccepted->value])
            ->selectRaw('SUM(CASE WHEN a.status = ? THEN 1 ELSE 0 END) as rejected', [ApplicationStatus::Rejected->value])
            ->selectRaw('SUM(CASE WHEN a.decided_at IS NULL THEN 1 ELSE 0 END) as still_open')
            ->orderByDesc('assigned')
            ->get()
            ->map(fn (object $row) => [
                'employee_id' => (string) $row->employee_id,
                'employee_number' => $row->employee_number,
                'name' => trim(($row->first_name ?? '').' '.($row->last_name ?? '')),
                'assigned' => (int) $row->assigned,
                'hires' => (int) $row->hires,
                'rejected' => (int) $row->rejected,
                'still_open' => (int) $row->still_open,
                'hire_rate' => (int) $row->assigned > 0
                    ? round(((int) $row->hires / (int) $row->assigned) * 100, 1)
                    : 0.0,
            ])->all();
    }

    /**
     * Offers outstanding and how they were answered.
     *
     * @return array<string, mixed>
     */
    public function offerPerformance(string $companyId, Carbon $start, Carbon $end): array
    {
        $rows = DB::table('hr_offers')
            ->where('company_id', $companyId)
            ->whereBetween('created_at', [$start, $end])
            ->groupBy('status')
            ->selectRaw('status, COUNT(*) as total')
            ->get()
            ->pluck('total', 'status');

        $sent = (int) ($rows[OfferStatus::Sent->value] ?? 0);
        $accepted = (int) ($rows[OfferStatus::Accepted->value] ?? 0);
        $declined = (int) ($rows[OfferStatus::Declined->value] ?? 0);
        $expired = (int) ($rows[OfferStatus::Expired->value] ?? 0);
        $answered = $accepted + $declined;

        return [
            'drafted' => (int) ($rows[OfferStatus::Draft->value] ?? 0),
            'awaiting_response' => $sent,
            'accepted' => $accepted,
            'declined' => $declined,
            'expired' => $expired,
            'withdrawn' => (int) ($rows[OfferStatus::Withdrawn->value] ?? 0),
            'acceptance_rate' => $this->rate($accepted, $answered, 'answered offers accepted'),
            // Offers that ran out of time are a process failure, not a candidate
            // decision, and they belong in a different column from "declined".
            'lapse_rate' => $this->rate($expired, $expired + $answered, 'offers that expired unanswered'),
        ];
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /** @return array<string, int> */
    private function applicationCounts(string $companyId, Carbon $start, Carbon $end): array
    {
        $row = DB::table('hr_job_applications')
            ->where('company_id', $companyId)
            ->whereBetween('applied_at', [$start, $end])
            ->selectRaw('COUNT(*) as total')
            ->selectRaw('SUM(CASE WHEN status IN (?, ?, ?) THEN 1 ELSE 0 END) as offered', [
                ApplicationStatus::OfferSent->value,
                ApplicationStatus::OfferAccepted->value,
                ApplicationStatus::OfferDeclined->value,
            ])
            ->selectRaw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as accepted', [ApplicationStatus::OfferAccepted->value])
            ->selectRaw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as hired', [ApplicationStatus::OfferAccepted->value])
            ->selectRaw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as rejected', [ApplicationStatus::Rejected->value])
            ->first();

        return [
            'total' => (int) ($row->total ?? 0),
            'offered' => (int) ($row->offered ?? 0),
            'accepted' => (int) ($row->accepted ?? 0),
            'hired' => (int) ($row->hired ?? 0),
            'rejected' => (int) ($row->rejected ?? 0),
        ];
    }

    /**
     * A rate that carries its own sample.
     *
     * @return array<string, mixed>
     */
    private function rate(int $numerator, int $denominator, string $meaning): array
    {
        return [
            'percent' => $denominator > 0 ? round(($numerator / $denominator) * 100, 1) : null,
            'numerator' => $numerator,
            'denominator' => $denominator,
            'meaning' => $meaning,
            // Explicit, so a dash on the dashboard is understood as "nothing to
            // measure" rather than "zero".
            'is_measurable' => $denominator > 0,
        ];
    }

    /** @return array<string, mixed> */
    private function ratio(int $numerator, int $denominator, string $numeratorLabel, string $denominatorLabel): array
    {
        return [
            'value' => $denominator > 0 ? round($numerator / $denominator, 1) : null,
            'numerator' => $numerator,
            'denominator' => $denominator,
            'meaning' => $numeratorLabel.' per '.$denominatorLabel,
            'is_measurable' => $denominator > 0,
        ];
    }

    /**
     * Empty months are generated first, so a quiet month renders as zero instead
     * of vanishing and making the chart lie about its own x-axis.
     *
     * @return array<string, array<string, mixed>>
     */
    private function months(Carbon $end, int $months): array
    {
        $months = min($months, self::MAX_BUCKETS);
        $buckets = [];
        $cursor = $end->copy()->startOfMonth()->subMonths($months - 1);

        for ($i = 0; $i < $months; $i++) {
            $buckets[$cursor->format('Y-m')] = [
                'month' => $cursor->format('Y-m'),
                'label' => $cursor->format('M Y'),
                'applications' => 0,
                'hires' => 0,
            ];
            $cursor->addMonth();
        }

        return $buckets;
    }

    private function firstBucketStart(Carbon $end, int $months): Carbon
    {
        return $end->copy()->startOfMonth()->subMonths(min($months, self::MAX_BUCKETS) - 1);
    }

    /** @return array{0: Carbon, 1: Carbon} */
    private function window(?string $from, ?string $to): array
    {
        $end = $to === null ? Carbon::now()->endOfDay() : Carbon::parse($to)->endOfDay();
        $start = $from === null ? $end->copy()->subMonths(11)->startOfMonth() : Carbon::parse($from)->startOfDay();

        return [$start, $end];
    }
}
