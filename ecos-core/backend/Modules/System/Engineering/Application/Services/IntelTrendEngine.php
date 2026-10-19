<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Models\EngineeringRelease;
use Modules\System\Engineering\Domain\Models\EngineeringReleaseValidation;
use Modules\System\Engineering\Domain\Models\GuardianRun;
use Modules\System\Engineering\Domain\Models\PatchValidation;
use Modules\System\Engineering\Domain\Models\RepairSession;

/**
 * Trend Analysis + Historical Comparison Engine (TASK-ENG-V2-004).
 *
 * Buckets engineering quality signals by day and classifies direction by
 * comparing half-window averages (the same ±5-point convention used by
 * the ENG-009 learning engine). Read-only.
 */
class IntelTrendEngine
{
    public function __construct(
        private readonly IntelAnalyticsEngine $analytics,
    ) {}

    /**
     * Daily buckets of repair success rate, validation accept rate, and
     * guardian allow rate plus a direction classification per series.
     *
     * @return array<string, mixed>
     */
    public function qualityTrend(string $companyId, int $days = 30): array
    {
        $series = [
            'repair_success_rate'    => $this->dailyRates(
                RepairSession::query()->toBase(),
                $companyId,
                $days,
                "SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)",
                "SUM(CASE WHEN status IN ('completed', 'failed', 'timeout') THEN 1 ELSE 0 END)",
            ),
            'validation_accept_rate' => $this->dailyRates(
                PatchValidation::query()->toBase(),
                $companyId,
                $days,
                "SUM(CASE WHEN verdict = 'accepted' THEN 1 ELSE 0 END)",
                "SUM(CASE WHEN verdict IN ('accepted', 'rejected') THEN 1 ELSE 0 END)",
            ),
            'guardian_allow_rate'    => $this->dailyRates(
                GuardianRun::query()->toBase(),
                $companyId,
                $days,
                "SUM(CASE WHEN decision = 'allow' THEN 1 ELSE 0 END)",
                "SUM(CASE WHEN decision IN ('allow', 'block') THEN 1 ELSE 0 END)",
            ),
        ];

        return [
            'window_days' => $days,
            'series'      => $series,
            'directions'  => array_map(
                fn (array $points): string => $this->direction(array_column($points, 'rate')),
                $series,
            ),
        ];
    }

    /**
     * Compare two trailing periods of equal length (e.g. this week vs
     * last week).
     *
     * @return array<string, mixed>
     */
    public function comparePeriods(string $companyId, int $days = 7): array
    {
        $current  = $this->analytics->overview($companyId, $days);
        $previous = $this->overviewBetween($companyId, $days * 2, $days);

        return [
            'period_days' => $days,
            'current'     => $current,
            'previous'    => $previous,
            'deltas'      => [
                'repair_success_rate'    => round($current['repairs']['success_rate'] - $previous['repairs']['success_rate'], 2),
                'validation_accept_rate' => round($current['validations']['accept_rate'] - $previous['validations']['accept_rate'], 2),
                'guardian_allow_rate'    => round($current['guardian']['allow_rate'] - $previous['guardian']['allow_rate'], 2),
            ],
        ];
    }

    /**
     * Historical comparison between two releases: composition, validation
     * results, and risk posture side by side.
     *
     * @return array<string, mixed>
     */
    public function compareReleases(string $companyId, string $releaseAId, string $releaseBId): array
    {
        $a = EngineeringRelease::query()->where('company_id', $companyId)->findOrFail($releaseAId);
        $b = EngineeringRelease::query()->where('company_id', $companyId)->findOrFail($releaseBId);

        $profileA = $this->releaseProfile($a);
        $profileB = $this->releaseProfile($b);

        return [
            'release_a' => $profileA,
            'release_b' => $profileB,
            'deltas'    => [
                'task_count'       => $profileB['task_count'] - $profileA['task_count'],
                'validation_score' => round($profileB['validation_score'] - $profileA['validation_score'], 2),
                'risk_count'       => $profileB['risk_count'] - $profileA['risk_count'],
                'artifact_count'   => $profileB['artifact_count'] - $profileA['artifact_count'],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function releaseProfile(EngineeringRelease $release): array
    {
        $validations = EngineeringReleaseValidation::query()
            ->toBase()
            ->selectRaw(
                'COUNT(*) AS total, '
                . 'SUM(CASE WHEN passed THEN 1 ELSE 0 END) AS passed, '
                . 'COALESCE(SUM(score_contribution), 0) AS score'
            )
            ->where('release_id', $release->id)
            ->first();

        return [
            'id'                 => $release->id,
            'name'               => $release->name,
            'version'            => $release->version,
            'status'             => $release->status,
            'task_count'         => is_array($release->task_ids) ? count($release->task_ids) : 0,
            'validation_total'   => (int) $validations->total,
            'validation_passed'  => (int) $validations->passed,
            'validation_score'   => (float) $validations->score,
            'risk_count'         => (int) $release->risks()->count(),
            'artifact_count'     => (int) $release->artifacts()->count(),
            'created_at'         => $release->created_at?->toIso8601String(),
        ];
    }

    /**
     * Overview restricted to a past window: [now - fromDays, now - toDays].
     *
     * @return array<string, mixed>
     */
    private function overviewBetween(string $companyId, int $fromDays, int $toDays): array
    {
        $from = now()->subDays($fromDays);
        $to   = now()->subDays($toDays);

        $sessions = RepairSession::query()->toBase()
            ->selectRaw(
                "SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed, "
                . "SUM(CASE WHEN status IN ('failed', 'timeout') THEN 1 ELSE 0 END) AS failed"
            )
            ->where('company_id', $companyId)
            ->whereBetween('created_at', [$from, $to])
            ->first();

        $validations = PatchValidation::query()->toBase()
            ->selectRaw(
                "SUM(CASE WHEN verdict = 'accepted' THEN 1 ELSE 0 END) AS accepted, "
                . "SUM(CASE WHEN verdict = 'rejected' THEN 1 ELSE 0 END) AS rejected"
            )
            ->where('company_id', $companyId)
            ->whereBetween('created_at', [$from, $to])
            ->first();

        $guardian = GuardianRun::query()->toBase()
            ->selectRaw(
                "SUM(CASE WHEN decision = 'allow' THEN 1 ELSE 0 END) AS allowed, "
                . "SUM(CASE WHEN decision = 'block' THEN 1 ELSE 0 END) AS blocked"
            )
            ->where('company_id', $companyId)
            ->whereBetween('created_at', [$from, $to])
            ->first();

        return [
            'repairs'     => [
                'completed'    => (int) $sessions->completed,
                'failed'       => (int) $sessions->failed,
                'success_rate' => $this->rate((int) $sessions->completed, (int) $sessions->completed + (int) $sessions->failed),
            ],
            'validations' => [
                'accepted'    => (int) $validations->accepted,
                'rejected'    => (int) $validations->rejected,
                'accept_rate' => $this->rate((int) $validations->accepted, (int) $validations->accepted + (int) $validations->rejected),
            ],
            'guardian'    => [
                'allowed'    => (int) $guardian->allowed,
                'blocked'    => (int) $guardian->blocked,
                'allow_rate' => $this->rate((int) $guardian->allowed, (int) $guardian->allowed + (int) $guardian->blocked),
            ],
        ];
    }

    /**
     * @return array<int, array{date: string, rate: float, total: int}>
     */
    private function dailyRates(
        \Illuminate\Database\Query\Builder $query,
        string $companyId,
        int $days,
        string $numeratorExpr,
        string $denominatorExpr,
    ): array {
        $rows = $query
            ->selectRaw(
                "DATE(created_at) AS bucket, {$numeratorExpr} AS numerator, {$denominatorExpr} AS denominator"
            )
            ->where('company_id', $companyId)
            ->where('created_at', '>=', now()->subDays($days))
            ->groupByRaw('DATE(created_at)')
            ->orderByRaw('DATE(created_at)')
            ->get();

        return $rows->map(fn ($row): array => [
            'date'  => (string) $row->bucket,
            'rate'  => $this->rate((int) $row->numerator, (int) $row->denominator),
            'total' => (int) $row->denominator,
        ])->all();
    }

    /**
     * Half-window comparison: recent half vs older half, ±5-point band.
     */
    private function direction(array $rates): string
    {
        if (count($rates) < 2) {
            return 'stable';
        }

        $half   = (int) floor(count($rates) / 2);
        $older  = array_slice($rates, 0, $half);
        $recent = array_slice($rates, $half);

        $olderAvg  = array_sum($older) / count($older);
        $recentAvg = array_sum($recent) / count($recent);

        return match (true) {
            $recentAvg > $olderAvg + 5 => 'improving',
            $recentAvg < $olderAvg - 5 => 'declining',
            default                    => 'stable',
        };
    }

    private function rate(int $numerator, int $denominator): float
    {
        if ($denominator === 0) {
            return 0.0;
        }

        return round(($numerator / $denominator) * 100.0, 2);
    }
}
