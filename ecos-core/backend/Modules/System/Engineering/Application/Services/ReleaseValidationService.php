<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Enums\ValidationStatus;
use Modules\System\Engineering\Domain\Models\EngineeringRelease;
use Modules\System\Engineering\Domain\Models\EngineeringReleaseValidation;
use Modules\System\Engineering\Domain\Models\EngineeringTask;

final class ReleaseValidationService
{
    public function runAll(EngineeringRelease $release): array
    {
        EngineeringReleaseValidation::where('release_id', $release->id)->delete();

        $checks = [
            ['type' => 'tasks',          'fn' => 'checkAllTasksCompleted',       'name' => 'All Tasks Completed',          'score' => 20, 'blocking' => true,  'severity' => 'error'],
            ['type' => 'tasks',          'fn' => 'checkNoFailedExecutions',       'name' => 'No Failed Executions',         'score' => 15, 'blocking' => true,  'severity' => 'error'],
            ['type' => 'tasks',          'fn' => 'checkNoPendingExecutions',      'name' => 'No Pending Executions',        'score' => 10, 'blocking' => true,  'severity' => 'error'],
            ['type' => 'artifacts',      'fn' => 'checkArtifactsPresent',         'name' => 'Artifacts Present',            'score' => 10, 'blocking' => false, 'severity' => 'warning'],
            ['type' => 'dependencies',   'fn' => 'checkDependenciesResolved',     'name' => 'Dependencies Resolved',        'score' => 15, 'blocking' => true,  'severity' => 'error'],
            ['type' => 'dependencies',   'fn' => 'checkNoCircularDependencies',   'name' => 'No Circular Dependencies',     'score' => 10, 'blocking' => true,  'severity' => 'error'],
            ['type' => 'tasks',          'fn' => 'checkNoBlockedTasks',           'name' => 'No Blocked Tasks',             'score' => 10, 'blocking' => true,  'severity' => 'error'],
            ['type' => 'documentation',  'fn' => 'checkTasksHaveDescriptions',    'name' => 'Tasks Have Descriptions',      'score' => 5,  'blocking' => false, 'severity' => 'warning'],
            ['type' => 'reports',        'fn' => 'checkReportsGenerated',         'name' => 'Reports Generated',            'score' => 5,  'blocking' => false, 'severity' => 'warning'],
            ['type' => 'ai_patches',     'fn' => 'checkNoUnverifiedAiPatches',    'name' => 'No Unverified AI Patches',     'score' => 10, 'blocking' => true,  'severity' => 'error'],
        ];

        $results = [];
        foreach ($checks as $check) {
            $result = $this->{$check['fn']}($release);
            $record = EngineeringReleaseValidation::create([
                'company_id'          => $release->company_id,
                'release_id'          => $release->id,
                'check_type'          => $check['type'],
                'check_name'          => $check['name'],
                'status'              => $result['passed'] ? ValidationStatus::Passed->value : ValidationStatus::Failed->value,
                'passed'              => $result['passed'],
                'message'             => $result['message'],
                'details'             => $result['details'] ?? null,
                'score_contribution'  => $result['passed'] ? $check['score'] : 0,
                'severity'            => $check['severity'],
                'is_blocking'         => $check['blocking'],
                'checked_at'          => now(),
            ]);
            $results[] = $record;
        }

        return $results;
    }

    public function getResults(EngineeringRelease $release): array
    {
        $all      = EngineeringReleaseValidation::where('release_id', $release->id)->get();
        $blocking = $all->where('is_blocking', true)->where('passed', false);
        return [
            'all'             => $all,
            'passed'          => $all->where('passed', true)->count(),
            'failed'          => $all->where('passed', false)->count(),
            'blocking_issues' => $blocking->count(),
            'can_proceed'     => $blocking->isEmpty(),
            'total_score'     => $all->sum('score_contribution'),
        ];
    }

    /**
     * Self-Healing Pipeline gate (TASK-ENG-V2-002): a release is not ready
     * while any applied AI repair patch has failed — or never ran —
     * validation. Rejected-but-unapplied patches never reach production,
     * so only applied patches block here.
     */
    private function checkNoUnverifiedAiPatches(EngineeringRelease $release): array
    {
        $unverified = \Modules\System\Engineering\Domain\Models\RepairPatch::query()
            ->where('company_id', $release->company_id)
            ->where('is_applied', true)
            ->where(function ($q) {
                $q->whereNull('verification_status')
                  ->orWhere('verification_status', '!=', 'passed');
            })
            ->count();

        return [
            'passed'  => $unverified === 0,
            'message' => $unverified === 0
                ? 'All applied AI patches passed validation'
                : "{$unverified} applied AI patches without a passed validation",
            'details' => ['unverified_applied_patches' => $unverified],
        ];
    }

    private function checkAllTasksCompleted(EngineeringRelease $release): array
    {
        if (empty($release->task_ids)) {
            return ['passed' => false, 'message' => 'Release has no tasks assigned'];
        }
        $incomplete = EngineeringTask::whereIn('id', $release->task_ids)
            ->whereNotIn('status', ['completed','released','archived'])->count();
        return [
            'passed'  => $incomplete === 0,
            'message' => $incomplete === 0 ? 'All tasks completed' : "{$incomplete} tasks not yet completed",
            'details' => ['incomplete_count' => $incomplete],
        ];
    }

    private function checkNoFailedExecutions(EngineeringRelease $release): array
    {
        if (empty($release->task_ids)) {
            return ['passed' => false, 'message' => 'No tasks assigned'];
        }
        $failed = EngineeringTask::whereIn('id', $release->task_ids)->where('status', 'failed')->count();
        return [
            'passed'  => $failed === 0,
            'message' => $failed === 0 ? 'No failed executions' : "{$failed} tasks failed",
            'details' => ['failed_count' => $failed],
        ];
    }

    private function checkNoPendingExecutions(EngineeringRelease $release): array
    {
        if (empty($release->task_ids)) {
            return ['passed' => false, 'message' => 'No tasks assigned'];
        }
        $pending = EngineeringTask::whereIn('id', $release->task_ids)->whereIn('status', ['queued','running','assigned'])->count();
        return [
            'passed'  => $pending === 0,
            'message' => $pending === 0 ? 'No pending executions' : "{$pending} tasks still running",
        ];
    }

    private function checkArtifactsPresent(EngineeringRelease $release): array
    {
        $count = $release->artifacts()->count();
        return ['passed' => $count > 0, 'message' => $count > 0 ? "{$count} artifacts attached" : 'No artifacts attached', 'details' => ['artifact_count' => $count]];
    }

    private function checkDependenciesResolved(EngineeringRelease $release): array
    {
        $unresolved = $release->dependencies()->where('status', 'unresolved')->where('is_blocking', true)->count();
        return [
            'passed'  => $unresolved === 0,
            'message' => $unresolved === 0 ? 'All blocking dependencies resolved' : "{$unresolved} blocking dependencies unresolved",
        ];
    }

    private function checkNoCircularDependencies(EngineeringRelease $release): array
    {
        $circular = $release->dependencies()->where('is_circular', true)->count();
        return [
            'passed'  => $circular === 0,
            'message' => $circular === 0 ? 'No circular dependencies' : "{$circular} circular dependencies detected",
        ];
    }

    private function checkNoBlockedTasks(EngineeringRelease $release): array
    {
        if (empty($release->task_ids)) {
            return ['passed' => true, 'message' => 'No tasks to check'];
        }
        $blocked = EngineeringTask::whereIn('id', $release->task_ids)->where('status', 'queued')->count();
        return ['passed' => $blocked === 0, 'message' => $blocked === 0 ? 'No blocked tasks' : "{$blocked} tasks blocked"];
    }

    private function checkTasksHaveDescriptions(EngineeringRelease $release): array
    {
        if (empty($release->task_ids)) {
            return ['passed' => false, 'message' => 'No tasks assigned'];
        }
        $missing = EngineeringTask::whereIn('id', $release->task_ids)->whereNull('description')->count();
        return ['passed' => $missing === 0, 'message' => $missing === 0 ? 'All tasks have descriptions' : "{$missing} tasks missing descriptions"];
    }

    private function checkReportsGenerated(EngineeringRelease $release): array
    {
        $count = $release->reports()->count();
        return ['passed' => $count > 0, 'message' => $count > 0 ? "{$count} reports generated" : 'No reports generated yet', 'details' => ['report_count' => $count]];
    }
}
