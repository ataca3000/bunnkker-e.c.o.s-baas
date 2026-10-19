<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Enums\ReviewDimension;
use Modules\System\Engineering\Domain\Models\EngineeringAIReview;
use Modules\System\Engineering\Domain\Models\EngineeringAIScore;
use Modules\System\Engineering\Domain\Models\EngineeringRelease;
use Modules\System\Engineering\Domain\Models\EngineeringTask;

class AIScoringEngine
{
    public function calculateAll(EngineeringAIReview $review): array
    {
        $scores = [];
        foreach (ReviewDimension::all() as $dimension) {
            $scores[$dimension->value] = $this->calculateDimension($review, $dimension);
        }
        return $scores;
    }

    public function getWeightedScore(EngineeringAIReview $review): float
    {
        $dbScores = EngineeringAIScore::where('review_id', $review->id)->get();
        if ($dbScores->isEmpty()) {
            return 0.0;
        }
        $totalWeightedScore = $dbScores->sum('weighted_score');
        $totalWeight        = $dbScores->sum('weight');
        return $totalWeight > 0 ? round($totalWeightedScore / $totalWeight * 100, 2) : 0.0;
    }

    public function updateReviewScore(EngineeringAIReview $review): float
    {
        $scores = EngineeringAIScore::where('review_id', $review->id)->get();
        if ($scores->isEmpty()) {
            $this->calculateAll($review);
            $scores = EngineeringAIScore::where('review_id', $review->id)->get();
        }
        $weighted = $scores->sum(fn($s) => $s->score * ($s->weight / 100));
        $overall  = round($weighted, 2);

        $dimensions = $scores->pluck('score', 'dimension')->toArray();
        $review->update([
            'overall_score' => $overall,
            'dimensions'    => $dimensions,
        ]);

        return $overall;
    }

    public function calculateDimension(EngineeringAIReview $review, ReviewDimension $dimension): EngineeringAIScore
    {
        // Remove existing score for this dimension if re-running
        EngineeringAIScore::where('review_id', $review->id)
            ->where('dimension', $dimension->value)
            ->delete();

        [$score, $details, $passed, $failed, $issues] = match($dimension) {
            ReviewDimension::Architecture    => $this->scoreArchitecture($review),
            ReviewDimension::Backend         => $this->scoreBackend($review),
            ReviewDimension::Frontend        => $this->scoreFrontend($review),
            ReviewDimension::Database        => $this->scoreDatabase($review),
            ReviewDimension::Security        => $this->scoreSecurity($review),
            ReviewDimension::Testing         => $this->scoreTesting($review),
            ReviewDimension::Documentation   => $this->scoreDocumentation($review),
            ReviewDimension::Performance     => $this->scorePerformance($review),
            ReviewDimension::Maintainability => $this->scoreMaintainability($review),
        };

        $weight        = $dimension->weight();
        $weightedScore = ($score / 100) * $weight;

        return EngineeringAIScore::create([
            'review_id'      => $review->id,
            'dimension'      => $dimension->value,
            'score'          => $score,
            'weight'         => $weight,
            'weighted_score' => round($weightedScore, 2),
            'details'        => $details,
            'issues_found'   => $issues,
            'passed_checks'  => $passed,
            'failed_checks'  => $failed,
        ]);
    }

    private function scoreArchitecture(EngineeringAIReview $review): array
    {
        $score   = 100;
        $details = [];
        $passed  = 0;
        $failed  = 0;

        // ADR compliance rate
        $archChecks = $review->architectureChecks()->get();
        if ($archChecks->isNotEmpty()) {
            $rate = ($archChecks->where('passed', true)->count() / $archChecks->count()) * 100;
            $score = min($score, $rate);
            $details['adr_compliance_rate'] = $rate;
            $passed += $archChecks->where('passed', true)->count();
            $failed += $archChecks->where('passed', false)->count();
        } else {
            $details['adr_compliance_rate'] = 100;
            $passed++;
        }

        // Circular dependencies = critical penalty
        $circular = $review->risks()->where('category', 'architecture')->where('severity', 'critical')->count();
        if ($circular > 0) { $score = 0; $failed++; $details['circular_deps'] = $circular; }
        else { $passed++; }

        return [max(0, round($score, 2)), $details, $passed, $failed, $failed];
    }

    private function scoreBackend(EngineeringAIReview $review): array
    {
        $score   = 100;
        $details = [];
        $passed  = 0;
        $failed  = 0;

        $total     = EngineeringTask::where('company_id', $review->company_id)->count();
        $completed = EngineeringTask::where('company_id', $review->company_id)->where('status', 'completed')->count();

        if ($total > 0) {
            $completionRate = ($completed / $total) * 100;
            if ($completionRate < 50) { $score -= 30; $failed++; } else { $passed++; }
            $details['task_completion_rate'] = round($completionRate, 2);
        } else {
            $passed++;
            $details['task_completion_rate'] = 100;
        }

        $failedPipelines = 0;
        if (class_exists('\\Modules\\System\\Engineering\\Domain\\Models\\EngineeringPipelineRun')) {
            $failedPipelines = \Modules\System\Engineering\Domain\Models\EngineeringPipelineRun
                ::where('company_id', $review->company_id)->where('status', 'failed')
                ->where('created_at', '>=', now()->subDays(7))->count();
            if ($failedPipelines > 3) { $score -= 20; $failed++; } else { $passed++; }
            $details['failed_pipelines_7d'] = $failedPipelines;
        } else { $passed++; }

        return [max(0, round($score, 2)), $details, $passed, $failed, $failed];
    }

    private function scoreFrontend(EngineeringAIReview $review): array
    {
        $score   = 80; // base score — no direct frontend checks in DB
        $details = ['note' => 'Frontend scored from release artifacts'];
        $passed  = 1;
        $failed  = 0;

        $releaseArtifacts = 0;
        if (class_exists('\\Modules\\System\\Engineering\\Domain\\Models\\EngineeringReleaseArtifact')) {
            $releaseArtifacts = \Modules\System\Engineering\Domain\Models\EngineeringReleaseArtifact
                ::whereHas('release', fn($q) => $q->where('company_id', $review->company_id))->count();
            if ($releaseArtifacts > 0) { $score += 20; $passed++; }
            $details['artifacts_count'] = $releaseArtifacts;
        }

        return [min(100, round($score, 2)), $details, $passed, $failed, $failed];
    }

    private function scoreDatabase(EngineeringAIReview $review): array
    {
        $score   = 100;
        $details = [];
        $passed  = 0;
        $failed  = 0;

        // Check circular deps as DB risk
        $circularDeps = 0;
        if (class_exists('\\Modules\\System\\Engineering\\Domain\\Models\\EngineeringReleaseDependency')) {
            $circularDeps = \Modules\System\Engineering\Domain\Models\EngineeringReleaseDependency
                ::whereHas('release', fn($q) => $q->where('company_id', $review->company_id))
                ->where('is_circular', true)->count();
        }
        if ($circularDeps > 0) { $score -= 40; $failed++; } else { $passed++; }
        $details['circular_dependencies'] = $circularDeps;

        // Releases with unresolved blocking deps
        $blockedDeps = 0;
        if (class_exists('\\Modules\\System\\Engineering\\Domain\\Models\\EngineeringReleaseDependency')) {
            $blockedDeps = \Modules\System\Engineering\Domain\Models\EngineeringReleaseDependency
                ::whereHas('release', fn($q) => $q->where('company_id', $review->company_id))
                ->where('is_blocking', true)->where('is_resolved', false)->count();
        }
        if ($blockedDeps > 0) { $score -= 20 * min($blockedDeps, 3); $failed++; } else { $passed++; }
        $details['unresolved_blocking_deps'] = $blockedDeps;

        return [max(0, round($score, 2)), $details, $passed, $failed, $failed];
    }

    private function scoreSecurity(EngineeringAIReview $review): array
    {
        $score   = 100;
        $details = [];
        $passed  = 0;
        $failed  = 0;

        $secChecks = $review->securityChecks()->get();
        if ($secChecks->isNotEmpty()) {
            $rate = ($secChecks->where('passed', true)->count() / $secChecks->count()) * 100;
            $score = $rate;
            $passed += $secChecks->where('passed', true)->count();
            $failed += $secChecks->where('passed', false)->count();
            $details['security_check_pass_rate'] = round($rate, 2);
        } else { $passed++; $details['security_check_pass_rate'] = 100; }

        // Critical unaccepted risks = 0 score
        if ($review->risk_count_critical > 0) {
            $unacceptedCritical = $review->risks()->where('severity', 'critical')->where('is_acknowledged', false)->count();
            if ($unacceptedCritical > 0) { $score = 0; $details['unaccepted_critical_risks'] = $unacceptedCritical; $failed++; }
        }

        return [max(0, round($score, 2)), $details, $passed, $failed, $failed];
    }

    private function scoreTesting(EngineeringAIReview $review): array
    {
        $score   = 100;
        $details = [];
        $passed  = 0;
        $failed  = 0;

        $releases = EngineeringRelease::where('company_id', $review->company_id)->count();
        $withReports = 0;
        if ($releases > 0 && class_exists('\\Modules\\System\\Engineering\\Domain\\Models\\EngineeringReleaseReport')) {
            $withReports = EngineeringRelease::where('company_id', $review->company_id)->has('reports')->count();
            $reportRate  = ($withReports / $releases) * 100;
            if ($reportRate < 80) { $score -= (80 - $reportRate); $failed++; } else { $passed++; }
            $details['releases_with_reports_rate'] = round($reportRate, 2);
        } else { $passed++; }

        $validationChecks = 0;
        if (class_exists('\\Modules\\System\\Engineering\\Domain\\Models\\EngineeringReleaseValidation')) {
            $validationChecks = \Modules\System\Engineering\Domain\Models\EngineeringReleaseValidation
                ::whereHas('release', fn($q) => $q->where('company_id', $review->company_id))
                ->where('passed', true)->count();
            $details['passing_validation_checks'] = $validationChecks;
            if ($validationChecks > 0) { $passed++; } else if ($releases > 0) { $failed++; $score -= 20; }
        }

        return [max(0, round($score, 2)), $details, $passed, $failed, $failed];
    }

    private function scoreDocumentation(EngineeringAIReview $review): array
    {
        $score   = 100;
        $details = [];
        $passed  = 0;
        $failed  = 0;

        $tasksWithDesc = EngineeringTask::where('company_id', $review->company_id)
            ->whereNotNull('description')->where('description', '!=', '')->count();
        $totalTasks    = EngineeringTask::where('company_id', $review->company_id)->count();

        if ($totalTasks > 0) {
            $descRate = ($tasksWithDesc / $totalTasks) * 100;
            if ($descRate < 70) { $score -= 30; $failed++; } else { $passed++; }
            $details['tasks_with_description_rate'] = round($descRate, 2);
        } else { $passed++; }

        if (class_exists('\\Modules\\System\\Engineering\\Domain\\Models\\EngineeringReleaseNote')) {
            $notes = \Modules\System\Engineering\Domain\Models\EngineeringReleaseNote
                ::whereHas('release', fn($q) => $q->where('company_id', $review->company_id))->count();
            if ($notes > 0) { $score = min(100, $score + 10); $passed++; } else { $failed++; $score -= 10; }
            $details['total_release_notes'] = $notes;
        }

        return [max(0, round($score, 2)), $details, $passed, $failed, $failed];
    }

    private function scorePerformance(EngineeringAIReview $review): array
    {
        $score   = 90;
        $details = ['note' => 'Performance scored from worker and pipeline metrics'];
        $passed  = 1;
        $failed  = 0;

        if (class_exists('\\Modules\\System\\Engineering\\Domain\\Models\\EngineeringWorker')) {
            $stalled = \Modules\System\Engineering\Domain\Models\EngineeringWorker
                ::where('company_id', $review->company_id)
                ->where('status', 'running')
                ->where('updated_at', '<', now()->subHours(2))->count();
            if ($stalled > 0) { $score -= 20 * min($stalled, 3); $failed++; } else { $passed++; }
            $details['stalled_workers'] = $stalled;
        }

        return [max(0, round($score, 2)), $details, $passed, $failed, $failed];
    }

    private function scoreMaintainability(EngineeringAIReview $review): array
    {
        $score   = 85;
        $details = [];
        $passed  = 1;
        $failed  = 0;

        $total     = EngineeringTask::where('company_id', $review->company_id)->count();
        $withDesc  = EngineeringTask::where('company_id', $review->company_id)->whereNotNull('description')->count();
        if ($total > 0) {
            $rate = ($withDesc / $total) * 100;
            $score = min(100, 70 + ($rate / 100) * 30);
            $details['task_description_rate'] = round($rate, 2);
            if ($rate >= 70) { $passed++; } else { $failed++; }
        }

        return [max(0, round($score, 2)), $details, $passed, $failed, $failed];
    }
}
