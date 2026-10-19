<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Application\Services;
use Modules\System\Engineering\Domain\Models\EngineeringRelease;
use Modules\System\Engineering\Domain\Models\EngineeringReleaseDependency;
use Modules\System\Engineering\Domain\Models\EngineeringTask;
use Modules\System\Engineering\Domain\Models\EngineeringTaskDependency;

final class ReleaseDependencyService
{
    public function analyzeAndSeed(EngineeringRelease $release): array
    {
        EngineeringReleaseDependency::where('release_id', $release->id)->delete();
        $deps = [];

        if (!empty($release->task_ids)) {
            $taskDeps = EngineeringTaskDependency::whereIn('task_id', $release->task_ids)->get();
            foreach ($taskDeps as $dep) {
                $isIncluded = in_array($dep->depends_on_task_id, $release->task_ids);
                $deps[] = EngineeringReleaseDependency::create([
                    'company_id'       => $release->company_id,
                    'release_id'       => $release->id,
                    'dependency_type'  => 'task',
                    'dependency_name'  => "Task: {$dep->depends_on_task_id}",
                    'status'           => $isIncluded ? 'resolved' : 'unresolved',
                    'is_blocking'      => $dep->dependency_type === 'blocked_by',
                    'is_circular'      => false,
                ]);
            }
            $circularIds = $this->detectCircularDependencies($release->task_ids);
            foreach ($circularIds as $tid) {
                EngineeringReleaseDependency::create([
                    'company_id'       => $release->company_id,
                    'release_id'       => $release->id,
                    'dependency_type'  => 'circular',
                    'dependency_name'  => "Circular: {$tid}",
                    'status'           => 'unresolved',
                    'is_blocking'      => true,
                    'is_circular'      => true,
                ]);
            }
        }
        return $deps;
    }

    public function resolve(EngineeringReleaseDependency $dep, string $notes = ''): void
    {
        $dep->update(['status' => 'resolved', 'resolution_notes' => $notes]);
    }

    public function getBlockingSummary(EngineeringRelease $release): array
    {
        $all      = EngineeringReleaseDependency::where('release_id', $release->id)->get();
        $blocking = $all->where('is_blocking', true)->where('status', 'unresolved');
        return [
            'total'    => $all->count(),
            'resolved' => $all->where('status', 'resolved')->count(),
            'blocking' => $blocking->count(),
            'circular' => $all->where('is_circular', true)->count(),
        ];
    }

    private function detectCircularDependencies(array $taskIds): array
    {
        $circular = [];
        $visited  = [];
        $stack    = [];
        foreach ($taskIds as $taskId) {
            if (!isset($visited[$taskId])) {
                $this->dfs($taskId, $visited, $stack, $circular);
            }
        }
        return array_unique($circular);
    }

    private function dfs(string $taskId, array &$visited, array &$stack, array &$circular): void
    {
        $visited[$taskId] = true;
        $stack[$taskId]   = true;
        $deps = EngineeringTaskDependency::where('task_id', $taskId)
            ->where('dependency_type', 'blocks')
            ->pluck('depends_on_task_id');
        foreach ($deps as $dep) {
            if (!isset($visited[$dep])) {
                $this->dfs($dep, $visited, $stack, $circular);
            } elseif (isset($stack[$dep])) {
                $circular[] = $dep;
            }
        }
        unset($stack[$taskId]);
    }
}
