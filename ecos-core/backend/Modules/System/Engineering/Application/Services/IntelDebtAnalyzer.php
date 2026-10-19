<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Models\EngineeringAIRecommendation;
use Modules\System\Engineering\Domain\Models\GuardianCheck;
use Modules\System\Engineering\Domain\Models\RepairPatch;
use Modules\System\Engineering\Domain\Models\RepairSession;

/**
 * Technical Debt Analyzer (TASK-ENG-V2-004).
 *
 * Aggregates debt signals from the engineering platforms into a weighted
 * 0-100 score with a per-signal breakdown. Deterministic: each signal is
 * a count normalized against a fixed saturation ceiling.
 *
 * Signals (weight):
 *  - recurring ADR violations, last 90d           (30)
 *  - open AI Supervisor recommendations           (25)
 *  - repair sessions failed with retries exhausted (20)
 *  - applied patches without passed validation     (15)
 *  - repair sessions stuck active for over 7 days  (10)
 */
class IntelDebtAnalyzer
{
    private const SIGNALS = [
        'adr_violations'      => ['weight' => 30, 'ceiling' => 20],
        'open_recommendations' => ['weight' => 25, 'ceiling' => 25],
        'exhausted_failures'  => ['weight' => 20, 'ceiling' => 10],
        'unverified_patches'  => ['weight' => 15, 'ceiling' => 5],
        'stale_sessions'      => ['weight' => 10, 'ceiling' => 10],
    ];

    /**
     * @return array<string, mixed>
     */
    public function analyze(string $companyId): array
    {
        $counts = [
            'adr_violations'       => $this->adrViolations($companyId),
            'open_recommendations' => $this->openRecommendations($companyId),
            'exhausted_failures'   => $this->exhaustedFailures($companyId),
            'unverified_patches'   => $this->unverifiedPatches($companyId),
            'stale_sessions'       => $this->staleSessions($companyId),
        ];

        $score     = 0.0;
        $breakdown = [];

        foreach (self::SIGNALS as $signal => $config) {
            $count        = $counts[$signal];
            $saturation   = min(1.0, $count / $config['ceiling']);
            $contribution = round($saturation * $config['weight'], 2);
            $score       += $contribution;

            $breakdown[] = [
                'signal'       => $signal,
                'count'        => $count,
                'weight'       => $config['weight'],
                'contribution' => $contribution,
            ];
        }

        $score = round(min(100.0, $score), 2);

        return [
            'debt_score' => $score,
            'debt_level' => $this->level($score),
            'breakdown'  => $breakdown,
        ];
    }

    private function adrViolations(string $companyId): int
    {
        return GuardianCheck::query()
            ->where('company_id', $companyId)
            ->where('category', 'adr_compliance')
            ->whereIn('status', ['failed', 'error'])
            ->where('created_at', '>=', now()->subDays(90))
            ->count();
    }

    private function openRecommendations(string $companyId): int
    {
        return EngineeringAIRecommendation::query()
            ->where('company_id', $companyId)
            ->where('is_resolved', false)
            ->count();
    }

    private function exhaustedFailures(string $companyId): int
    {
        return RepairSession::query()
            ->where('company_id', $companyId)
            ->whereIn('status', ['failed', 'timeout'])
            ->whereColumn('retry_count', '>=', 'max_retries')
            ->count();
    }

    private function unverifiedPatches(string $companyId): int
    {
        return RepairPatch::query()
            ->where('company_id', $companyId)
            ->where('is_applied', true)
            ->where(function ($q) {
                $q->whereNull('verification_status')
                  ->orWhere('verification_status', '!=', 'passed');
            })
            ->count();
    }

    private function staleSessions(string $companyId): int
    {
        return RepairSession::query()
            ->where('company_id', $companyId)
            ->whereNotIn('status', ['completed', 'failed', 'cancelled', 'timeout'])
            ->where('created_at', '<', now()->subDays(7))
            ->count();
    }

    private function level(float $score): string
    {
        return match (true) {
            $score >= 80.0 => 'critical',
            $score >= 60.0 => 'high',
            $score >= 30.0 => 'moderate',
            default        => 'low',
        };
    }
}
