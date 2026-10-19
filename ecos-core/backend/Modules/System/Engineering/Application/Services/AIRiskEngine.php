<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Models\EngineeringAIReview;
use Modules\System\Engineering\Domain\Models\EngineeringAIRisk;
use Modules\System\Engineering\Domain\Models\EngineeringTask;
use Modules\System\Engineering\Domain\Models\EngineeringRelease;
use Modules\System\Engineering\Domain\Enums\RiskSeverity;

class AIRiskEngine
{
    public function runAll(EngineeringAIReview $review): array
    {
        $risks = array_merge(
            $this->analyzeArchitectureRisks($review),
            $this->analyzeQualityRisks($review),
            $this->analyzeTestingRisks($review),
            $this->analyzeDocumentationRisks($review),
            $this->analyzePerformanceRisks($review),
            $this->analyzeSecurityRisks($review),
            $this->analyzeDependencyRisks($review),
        );

        // Update risk counts on review
        $critical = collect($risks)->where('severity', RiskSeverity::Critical->value)->count();
        $high     = collect($risks)->where('severity', RiskSeverity::High->value)->count();
        $medium   = collect($risks)->where('severity', RiskSeverity::Medium->value)->count();
        $low      = collect($risks)->where('severity', RiskSeverity::Low->value)->count();
        $blocking = $critical > 0;

        $review->update([
            'risk_count_critical' => $critical,
            'risk_count_high'     => $high,
            'risk_count_medium'   => $medium,
            'risk_count_low'      => $low,
            'is_blocking'         => $blocking,
        ]);

        return $risks;
    }

    public function analyzeArchitectureRisks(EngineeringAIReview $review): array
    {
        $risks = [];

        // Check for circular dependencies in releases
        if (class_exists('\\Modules\\System\\Engineering\\Domain\\Models\\EngineeringReleaseDependency')) {
            $circular = \Modules\System\Engineering\Domain\Models\EngineeringReleaseDependency
                ::whereHas('release', fn($q) => $q->where('company_id', $review->company_id))
                ->where('is_circular', true)->count();
            if ($circular > 0) {
                $risks[] = $this->createRisk($review, [
                    'severity'       => RiskSeverity::Critical,
                    'category'       => 'architecture',
                    'title'          => 'Circular Dependencies Detected',
                    'description'    => "{$circular} circular dependency chains found in release dependencies.",
                    'impact'         => 'Circular dependencies will cause deployment failures and runtime errors.',
                    'recommendation' => 'Resolve circular dependencies before proceeding to release.',
                    'is_blocking'    => true,
                    'priority'       => 1,
                    'evidence'       => ['circular_count' => $circular],
                ]);
            }
        }

        // Check for tasks without execution results
        $completedWithoutFindings = EngineeringTask::where('company_id', $review->company_id)
            ->where('status', 'completed')
            ->doesntHave('findings')
            ->count();
        if ($completedWithoutFindings > 3) {
            $risks[] = $this->createRisk($review, [
                'severity'       => RiskSeverity::Medium,
                'category'       => 'architecture',
                'title'          => 'Completed Tasks Without Quality Findings',
                'description'    => "{$completedWithoutFindings} completed tasks have no associated quality findings.",
                'impact'         => 'Tasks without findings bypass the quality gate, increasing risk of unreviewed code reaching production.',
                'recommendation' => 'Ensure all completed tasks have associated code review findings.',
                'is_blocking'    => false,
                'priority'       => 30,
                'evidence'       => ['count' => $completedWithoutFindings],
            ]);
        }

        return $risks;
    }

    public function analyzeSecurityRisks(EngineeringAIReview $review): array
    {
        $risks = [];

        // Check for releases without security reports
        $releasesWithoutReports = EngineeringRelease::where('company_id', $review->company_id)
            ->whereIn('status', ['ready', 'approval_pending', 'approved', 'queued'])
            ->whereDoesntHave('reports')
            ->count();

        if ($releasesWithoutReports > 0) {
            $risks[] = $this->createRisk($review, [
                'severity'       => RiskSeverity::High,
                'category'       => 'security',
                'title'          => 'Releases Without Security Reports',
                'description'    => "{$releasesWithoutReports} release(s) approaching pipeline have no generated security reports.",
                'impact'         => 'Security vulnerabilities may reach production without documentation.',
                'recommendation' => 'Generate all 5 release reports including risk_report before pipeline trigger.',
                'is_blocking'    => false,
                'priority'       => 10,
                'evidence'       => ['count' => $releasesWithoutReports],
            ]);
        }

        // Check for critical risks not accepted in releases
        if (class_exists('\\Modules\\System\\Engineering\\Domain\\Models\\EngineeringReleaseRisk')) {
            $unacceptedCritical = \Modules\System\Engineering\Domain\Models\EngineeringReleaseRisk
                ::whereHas('release', fn($q) => $q->where('company_id', $review->company_id)->whereIn('status', ['approved', 'queued']))
                ->where('severity', 'critical')
                ->where('is_accepted', false)
                ->count();
            if ($unacceptedCritical > 0) {
                $risks[] = $this->createRisk($review, [
                    'severity'       => RiskSeverity::Critical,
                    'category'       => 'security',
                    'title'          => 'Unaccepted Critical Release Risks',
                    'description'    => "{$unacceptedCritical} critical risk(s) in queued/approved releases have not been accepted.",
                    'impact'         => 'Critical unaccepted risks will block the readiness scorer from reaching full score.',
                    'recommendation' => 'Accept or mitigate all critical risks before release.',
                    'is_blocking'    => true,
                    'priority'       => 2,
                    'evidence'       => ['unaccepted_critical' => $unacceptedCritical],
                ]);
            }
        }

        return $risks;
    }

    public function analyzeQualityRisks(EngineeringAIReview $review): array
    {
        $risks = [];

        $failedRuns = 0;
        if (class_exists('\\Modules\\System\\Engineering\\Domain\\Models\\EngineeringPipelineRun')) {
            $failedRuns = \Modules\System\Engineering\Domain\Models\EngineeringPipelineRun
                ::where('company_id', $review->company_id)
                ->where('status', 'failed')
                ->where('created_at', '>=', now()->subDays(7))
                ->count();
        }
        if ($failedRuns > 5) {
            $risks[] = $this->createRisk($review, [
                'severity'       => RiskSeverity::High,
                'category'       => 'quality',
                'title'          => 'High Pipeline Failure Rate (Last 7 Days)',
                'description'    => "{$failedRuns} pipeline failures in the last 7 days.",
                'impact'         => 'Repeated failures indicate unstable builds or flaky test suites.',
                'recommendation' => 'Investigate root causes of pipeline failures before new releases.',
                'is_blocking'    => false,
                'priority'       => 15,
                'evidence'       => ['failed_runs_7d' => $failedRuns],
            ]);
        }

        return $risks;
    }

    public function analyzeTestingRisks(EngineeringAIReview $review): array
    {
        $risks = [];

        $completedTasks   = EngineeringTask::where('company_id', $review->company_id)->where('status', 'completed')->count();
        $tasksWithResults = EngineeringTask::where('company_id', $review->company_id)->where('status', 'completed')->whereNotNull('completed_at')->count();

        if ($completedTasks > 0) {
            $coverageRate = ($tasksWithResults / $completedTasks) * 100;
            if ($coverageRate < 80) {
                $risks[] = $this->createRisk($review, [
                    'severity'       => RiskSeverity::Medium,
                    'category'       => 'testing',
                    'title'          => 'Incomplete Task Completion Documentation',
                    'description'    => sprintf('Only %.0f%% of completed tasks have a completion timestamp.', $coverageRate),
                    'impact'         => 'Tasks without proper completion records cannot be reliably included in release readiness scoring.',
                    'recommendation' => 'Ensure all completed tasks have a completed_at timestamp before inclusion in a release.',
                    'is_blocking'    => false,
                    'priority'       => 40,
                    'evidence'       => ['coverage_rate' => $coverageRate],
                ]);
            }
        }

        return $risks;
    }

    public function analyzeDocumentationRisks(EngineeringAIReview $review): array
    {
        $risks = [];

        $releasesWithoutNotes = EngineeringRelease::where('company_id', $review->company_id)
            ->whereIn('status', ['ready', 'approval_pending', 'approved'])
            ->whereDoesntHave('notes')
            ->count();

        if ($releasesWithoutNotes > 0) {
            $risks[] = $this->createRisk($review, [
                'severity'       => RiskSeverity::Low,
                'category'       => 'documentation',
                'title'          => 'Releases Without Release Notes',
                'description'    => "{$releasesWithoutNotes} release(s) have no release notes added.",
                'impact'         => 'Missing release notes reduce transparency for stakeholders and operations teams.',
                'recommendation' => 'Add release notes to all pending releases.',
                'is_blocking'    => false,
                'priority'       => 60,
                'evidence'       => ['count' => $releasesWithoutNotes],
            ]);
        }

        return $risks;
    }

    public function analyzePerformanceRisks(EngineeringAIReview $review): array
    {
        $risks = [];

        // Check for workers with very long run times
        if (class_exists('\\Modules\\System\\Engineering\\Domain\\Models\\EngineeringWorker')) {
            $longRunningWorkers = \Modules\System\Engineering\Domain\Models\EngineeringWorker
                ::where('company_id', $review->company_id)
                ->where('status', 'running')
                ->where('updated_at', '<', now()->subHours(2))
                ->count();
            if ($longRunningWorkers > 0) {
                $risks[] = $this->createRisk($review, [
                    'severity'       => RiskSeverity::Medium,
                    'category'       => 'performance',
                    'title'          => 'Long-Running Workers Detected',
                    'description'    => "{$longRunningWorkers} worker(s) have been in running state for more than 2 hours.",
                    'impact'         => 'Long-running workers may indicate hung processes or infinite loops.',
                    'recommendation' => 'Investigate and restart stalled workers via the Cluster Dashboard.',
                    'is_blocking'    => false,
                    'priority'       => 35,
                    'evidence'       => ['long_running_count' => $longRunningWorkers],
                ]);
            }
        }

        return $risks;
    }

    public function analyzeDependencyRisks(EngineeringAIReview $review): array
    {
        $risks = [];

        if (class_exists('\\Modules\\System\\Engineering\\Domain\\Models\\EngineeringReleaseDependency')) {
            $blockedDeps = \Modules\System\Engineering\Domain\Models\EngineeringReleaseDependency
                ::whereHas('release', fn($q) => $q->where('company_id', $review->company_id))
                ->where('is_blocking', true)
                ->where('is_resolved', false)
                ->count();
            if ($blockedDeps > 0) {
                $risks[] = $this->createRisk($review, [
                    'severity'       => RiskSeverity::High,
                    'category'       => 'dependency',
                    'title'          => 'Unresolved Blocking Dependencies',
                    'description'    => "{$blockedDeps} blocking dependency(ies) remain unresolved.",
                    'impact'         => 'Blocking dependencies prevent release pipeline from starting successfully.',
                    'recommendation' => 'Resolve all blocking dependencies before triggering pipeline.',
                    'is_blocking'    => false,
                    'priority'       => 12,
                    'evidence'       => ['blocked_count' => $blockedDeps],
                ]);
            }
        }

        return $risks;
    }

    public function acknowledgeRisk(EngineeringAIRisk $risk, string $actorId): void
    {
        $risk->update([
            'is_acknowledged' => true,
            'acknowledged_by' => $actorId,
            'acknowledged_at' => now(),
        ]);
    }

    private function createRisk(EngineeringAIReview $review, array $data): EngineeringAIRisk
    {
        return EngineeringAIRisk::create([
            'review_id'       => $review->id,
            'company_id'      => $review->company_id,
            'severity'        => $data['severity'] instanceof RiskSeverity ? $data['severity']->value : $data['severity'],
            'category'        => $data['category'],
            'title'           => $data['title'],
            'description'     => $data['description'],
            'impact'          => $data['impact'],
            'recommendation'  => $data['recommendation'],
            'priority'        => $data['priority'],
            'is_blocking'     => $data['is_blocking'],
            'evidence'        => $data['evidence'] ?? null,
        ]);
    }
}
