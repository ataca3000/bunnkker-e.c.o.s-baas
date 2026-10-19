<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Models\EngineeringRelease;
use Modules\System\Engineering\Domain\Models\EngineeringReleaseValidation;
use Modules\System\Engineering\Domain\Models\EngineeringTask;

final class ReleaseReadinessScorer
{
    public function calculate(EngineeringRelease $release): array
    {
        $breakdown = [
            'architecture'  => $this->scoreArchitecture($release),
            'backend'       => $this->scoreBackend($release),
            'frontend'      => $this->scoreFrontend($release),
            'database'      => $this->scoreDatabase($release),
            'testing'       => $this->scoreTesting($release),
            'documentation' => $this->scoreDocumentation($release),
            'security'      => $this->scoreSecurity($release),
            'deployment'    => $this->scoreDeployment($release),
        ];

        $overall = (int) round(array_sum($breakdown) / count($breakdown));

        $release->update([
            'readiness_score'      => $overall,
            'readiness_breakdown'  => $breakdown,
        ]);

        $checks = EngineeringReleaseValidation::where('release_id', $release->id)->get();
        return [
            'overall'        => $overall,
            'breakdown'      => $breakdown,
            'checks'         => $checks,
            'blocking_issues' => $checks->where('is_blocking', true)->where('passed', false)->values(),
            'warnings'       => $checks->where('severity', 'warning')->where('passed', false)->values(),
        ];
    }

    private function scoreArchitecture(EngineeringRelease $release): int
    {
        $score = 50;
        if (!empty($release->task_ids)) { $score += 25; }
        if ($release->description) { $score += 25; }
        return min(100, $score);
    }

    private function scoreBackend(EngineeringRelease $release): int
    {
        if (empty($release->task_ids)) { return 0; }
        $total     = count($release->task_ids);
        $completed = EngineeringTask::whereIn('id', $release->task_ids)
            ->whereIn('status', ['completed','released'])->count();
        return $total > 0 ? (int) round($completed / $total * 100) : 0;
    }

    private function scoreFrontend(EngineeringRelease $release): int
    {
        $artifacts = $release->artifacts()->where('artifact_type', 'frontend')->count();
        return min(100, $artifacts * 25 + ($release->task_count > 0 ? 50 : 0));
    }

    private function scoreDatabase(EngineeringRelease $release): int
    {
        $deps = $release->dependencies()->where('dependency_type', 'database')->get();
        if ($deps->isEmpty()) { return 90; }
        $resolved = $deps->where('status', 'resolved')->count();
        return (int) round($resolved / $deps->count() * 100);
    }

    private function scoreTesting(EngineeringRelease $release): int
    {
        $reports    = $release->reports()->where('report_type', 'test_results')->count();
        $validCheck = EngineeringReleaseValidation::where('release_id', $release->id)
            ->where('check_type', 'tasks')->where('passed', true)->count();
        return min(100, ($reports > 0 ? 50 : 0) + ($validCheck > 0 ? 50 : 0));
    }

    private function scoreDocumentation(EngineeringRelease $release): int
    {
        $reports = $release->reports()->count();
        $notes   = $release->notes()->count();
        return min(100, ($reports * 20) + ($notes * 10));
    }

    private function scoreSecurity(EngineeringRelease $release): int
    {
        $criticalRisks = $release->risks()->where('severity', 'critical')->where('is_accepted', false)->count();
        if ($criticalRisks > 0) { return 0; }
        $highRisks = $release->risks()->where('severity', 'high')->where('is_accepted', false)->count();
        return max(0, 100 - ($highRisks * 25));
    }

    private function scoreDeployment(EngineeringRelease $release): int
    {
        $score = 50;
        if ($release->packages()->count() > 0) { $score += 25; }
        if ($release->target_environment) { $score += 25; }
        return $score;
    }
}
