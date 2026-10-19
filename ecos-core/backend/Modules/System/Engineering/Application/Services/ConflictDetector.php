<?php

declare(strict_types=1);
namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Models\EngineeringBranchLock;
use Modules\System\Engineering\Domain\Models\EngineeringFileLock;
use Modules\System\Engineering\Domain\Models\EngineeringTask;
use Modules\System\Engineering\Domain\Models\EngineeringTaskDependency;
use Modules\System\Engineering\Domain\Models\EngineeringWorkspaceLock;

final class ConflictDetector
{
    public function detectConflicts(
        EngineeringTask $task,
        string $repositoryPath = '',
        string $workspacePath = ''
    ): array {
        $wsConflicts  = $this->checkWorkspaceConflicts($workspacePath);
        $brConflicts  = $this->checkBranchConflicts($repositoryPath, 'feature/task-' . $task->id);
        $fileConflicts = $this->checkFileConflicts($repositoryPath, $task->id);
        $depBlocks     = $this->checkDependencyBlocks($task);

        return [
            'has_conflicts'       => !empty($wsConflicts) || !empty($brConflicts) || !empty($fileConflicts) || !empty($depBlocks),
            'workspace_conflicts' => $wsConflicts,
            'branch_conflicts'    => $brConflicts,
            'file_conflicts'      => $fileConflicts,
            'dependency_blocks'   => $depBlocks,
        ];
    }

    public function hasConflicts(EngineeringTask $task, string $repositoryPath = '', string $workspacePath = ''): bool
    {
        return $this->detectConflicts($task, $repositoryPath, $workspacePath)['has_conflicts'];
    }

    public function checkWorkspaceConflicts(string $workspacePath): array
    {
        if (empty($workspacePath)) {
            return [];
        }
        $lock = EngineeringWorkspaceLock::where('workspace_path', $workspacePath)
            ->where(fn($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->first();
        return $lock
            ? [['workspace_path' => $workspacePath, 'locked_by_task_id' => $lock->task_id, 'locked_by_worker_id' => $lock->worker_id]]
            : [];
    }

    public function checkBranchConflicts(string $repositoryPath, string $branchName): array
    {
        if (empty($repositoryPath) || empty($branchName)) {
            return [];
        }
        $lock = EngineeringBranchLock::where('repository_path', $repositoryPath)
            ->where('branch_name', $branchName)
            ->where(fn($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->first();
        return $lock ? [['branch_name' => $branchName, 'locked_by_task_id' => $lock->task_id]] : [];
    }

    public function checkFileConflicts(string $repositoryPath, string $taskId): array
    {
        if (empty($repositoryPath)) {
            return [];
        }
        return EngineeringFileLock::where('repository_path', $repositoryPath)
            ->where('task_id', '!=', $taskId)
            ->where(fn($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->get()
            ->map(fn($l) => ['file_path' => $l->file_path, 'locked_by_task_id' => $l->task_id, 'lock_type' => $l->lock_type])
            ->toArray();
    }

    public function checkDependencyBlocks(EngineeringTask $task): array
    {
        $task->loadMissing('dependencies.dependsOnTask');
        $terminal = ['completed', 'released', 'cancelled', 'archived'];
        $blocks = [];
        foreach ($task->dependencies as $dep) {
            if ($dep->dependency_type === 'blocked_by' && $dep->dependsOnTask) {
                $blocker = $dep->dependsOnTask;
                if (!in_array($blocker->status->value, $terminal)) {
                    $blocks[] = [
                        'blocking_task_id'    => $blocker->id,
                        'blocking_task_title' => $blocker->title,
                        'status'              => $blocker->status->value,
                    ];
                }
            }
        }
        return $blocks;
    }

    public function detectCircularDependencies(string $taskId): bool
    {
        $visited = [];
        $queue   = [$taskId];
        while (!empty($queue)) {
            $current = array_shift($queue);
            if (isset($visited[$current])) {
                return true;
            }
            $visited[$current] = true;
            $deps = EngineeringTaskDependency::where('task_id', $current)
                ->where('dependency_type', 'blocks')
                ->pluck('depends_on_task_id')
                ->toArray();
            $queue = array_merge($queue, $deps);
        }
        return false;
    }

    public function acquireFileLocks(
        string $repositoryPath,
        array $filePaths,
        string $workerId,
        string $taskId,
        string $companyId,
        string $lockType = 'write'
    ): void {
        $now     = now();
        $expires = $now->copy()->addHours(2);
        $rows    = array_map(fn($fp) => [
            'company_id'      => $companyId,
            'repository_path' => $repositoryPath,
            'file_path'       => $fp,
            'worker_id'       => $workerId,
            'task_id'         => $taskId,
            'lock_type'       => $lockType,
            'expires_at'      => $expires,
            'acquired_at'     => $now,
        ], $filePaths);
        EngineeringFileLock::insert($rows);
    }

    public function releaseAllFileLocks(string $workerId): int
    {
        return EngineeringFileLock::where('worker_id', $workerId)->delete();
    }

    public function purgeExpiredFileLocks(): int
    {
        return EngineeringFileLock::where('expires_at', '<', now())->delete();
    }
}
