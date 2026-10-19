<?php

declare(strict_types=1);
namespace Modules\System\Engineering\Application\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Process;
use Modules\System\Engineering\Domain\Models\EngineeringWorker;
use Modules\System\Engineering\Domain\Models\EngineeringTask;
use Modules\System\Engineering\Domain\Models\EngineeringBranchLock;

final class BranchManager
{
    public function getBranchName(string $taskId): string
    {
        return 'feature/task-' . $taskId;
    }

    public function prepareBranch(string $repositoryPath, string $branchName, string $baseBranch = 'main'): array
    {
        Process::path($repositoryPath)->run(['git', 'fetch', 'origin']);
        $existing = Process::path($repositoryPath)->run(['git', 'ls-remote', '--heads', 'origin', $branchName]);
        if (!empty(trim($existing->output()))) {
            Process::path($repositoryPath)->run(['git', 'checkout', '-B', $branchName, 'origin/' . $branchName]);
        } else {
            Process::path($repositoryPath)->run(['git', 'checkout', $baseBranch]);
            Process::path($repositoryPath)->run(['git', 'pull', 'origin', $baseBranch]);
            Process::path($repositoryPath)->run(['git', 'checkout', '-b', $branchName]);
        }
        $commit = trim(Process::path($repositoryPath)->run(['git', 'rev-parse', 'HEAD'])->output());
        return ['branch' => $branchName, 'commit' => $commit];
    }

    public function acquireLock(
        EngineeringWorker $worker,
        EngineeringTask $task,
        string $repositoryPath,
        string $branchName,
        int $ttlMinutes = 120
    ): EngineeringBranchLock {
        return DB::transaction(function () use ($worker, $task, $repositoryPath, $branchName, $ttlMinutes) {
            $existing = EngineeringBranchLock::where('repository_path', $repositoryPath)
                ->where('branch_name', $branchName)->first();
            if ($existing && !$existing->isExpired() && $existing->worker_id !== $worker->id) {
                throw new \RuntimeException("Branch [{$branchName}] is locked by worker [{$existing->worker_id}]");
            }
            if ($existing) {
                $existing->delete();
            }
            return EngineeringBranchLock::create([
                'company_id'      => $worker->company_id,
                'repository_path' => $repositoryPath,
                'branch_name'     => $branchName,
                'worker_id'       => $worker->id,
                'task_id'         => $task->id,
                'expires_at'      => now()->addMinutes($ttlMinutes),
                'acquired_at'     => now(),
            ]);
        });
    }

    public function releaseLock(string $workerId, string $repositoryPath, string $branchName): void
    {
        EngineeringBranchLock::where('repository_path', $repositoryPath)
            ->where('branch_name', $branchName)
            ->where('worker_id', $workerId)
            ->delete();
    }

    public function releaseAllLocks(string $workerId): int
    {
        return EngineeringBranchLock::where('worker_id', $workerId)->delete();
    }

    public function purgeExpiredLocks(): int
    {
        return EngineeringBranchLock::where('expires_at', '<', now())->delete();
    }

    public function isLocked(string $repositoryPath, string $branchName): bool
    {
        return EngineeringBranchLock::where('repository_path', $repositoryPath)
            ->where('branch_name', $branchName)
            ->where(fn($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->exists();
    }

    public function validateBranch(string $repositoryPath, string $branchName): bool
    {
        $result = Process::path($repositoryPath)->run(['git', 'branch', '--list', $branchName]);
        return $result->successful() && str_contains($result->output(), $branchName);
    }

    public function cleanupBranch(string $repositoryPath, string $branchName): void
    {
        Process::path($repositoryPath)->run(['git', 'branch', '-D', $branchName]);
    }

    public function checkMergeReadiness(string $repositoryPath, string $branchName, string $targetBranch = 'main'): array
    {
        $diff = Process::path($repositoryPath)->run(['git', 'diff', '--name-only', $targetBranch . '..' . $branchName]);
        return [
            'changed_files' => array_filter(explode("\n", trim($diff->output()))),
            'has_conflicts'  => false,
        ];
    }
}
