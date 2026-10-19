<?php

declare(strict_types=1);
namespace Modules\System\Engineering\Application\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Process;
use Modules\System\Engineering\Domain\Models\EngineeringWorker;
use Modules\System\Engineering\Domain\Models\EngineeringTask;
use Modules\System\Engineering\Domain\Models\EngineeringWorkspaceLock;

final class WorkspaceManager
{
    public function __construct(
        private readonly string $basePath = '/var/engineering/workspaces',
    ) {}

    public function getWorkspacePath(string $workerId, string $taskId): string
    {
        return rtrim($this->basePath, '/') . '/' . $workerId . '/' . $taskId;
    }

    public function provision(EngineeringWorker $worker, EngineeringTask $task): string
    {
        $path = $this->getWorkspacePath($worker->id, $task->id);
        if (!is_dir($path)) {
            mkdir($path, 0755, true);
        }
        file_put_contents(
            $path . '/TASK.md',
            "# {$task->title}\n\n{$task->description}\n\nTask ID: {$task->id}\n"
        );
        return $path;
    }

    public function acquireLock(
        EngineeringWorker $worker,
        EngineeringTask $task,
        string $workspacePath,
        int $ttlMinutes = 120
    ): EngineeringWorkspaceLock {
        return DB::transaction(function () use ($worker, $task, $workspacePath, $ttlMinutes) {
            $existing = EngineeringWorkspaceLock::where('workspace_path', $workspacePath)->first();

            if ($existing && !$existing->isExpired() && $existing->worker_id !== $worker->id) {
                throw new \RuntimeException(
                    "Workspace [{$workspacePath}] is locked by worker [{$existing->worker_id}] for task [{$existing->task_id}]"
                );
            }

            if ($existing) {
                $existing->delete();
            }

            return EngineeringWorkspaceLock::create([
                'company_id'     => $worker->company_id,
                'workspace_path' => $workspacePath,
                'worker_id'      => $worker->id,
                'task_id'        => $task->id,
                'expires_at'     => now()->addMinutes($ttlMinutes),
                'acquired_at'    => now(),
                'lock_reason'    => "Task {$task->id} executing on worker {$worker->id}",
            ]);
        });
    }

    public function releaseLock(string $workerId, string $workspacePath): void
    {
        EngineeringWorkspaceLock::where('workspace_path', $workspacePath)
            ->where('worker_id', $workerId)
            ->delete();
    }

    public function releaseAllLocks(string $workerId): int
    {
        return EngineeringWorkspaceLock::where('worker_id', $workerId)->delete();
    }

    public function purgeExpiredLocks(): int
    {
        return EngineeringWorkspaceLock::where('expires_at', '<', now())->delete();
    }

    public function cleanup(string $workspacePath): void
    {
        if (is_dir($workspacePath)) {
            Process::run(['rm', '-rf', $workspacePath]);
        }
    }

    public function snapshot(string $workspacePath, string $sessionId): string
    {
        $snapshotPath = dirname($workspacePath) . '/.snapshots/' . $sessionId;
        if (!is_dir(dirname($snapshotPath))) {
            mkdir(dirname($snapshotPath), 0755, true);
        }
        Process::run(['cp', '-r', $workspacePath, $snapshotPath]);
        return $snapshotPath;
    }

    public function getDiskUsageMb(string $workspacePath): float
    {
        if (!is_dir($workspacePath)) {
            return 0.0;
        }
        $result = Process::run(['du', '-sm', $workspacePath]);
        if ($result->successful()) {
            return (float) explode("\t", trim($result->output()))[0];
        }
        return 0.0;
    }

    public function validate(string $workspacePath): bool
    {
        return is_dir($workspacePath) && is_writable($workspacePath);
    }

    public function renewLock(EngineeringWorkspaceLock $lock, int $additionalMinutes = 30): void
    {
        $lock->update([
            'expires_at' => ($lock->expires_at ?? now())->addMinutes($additionalMinutes),
        ]);
    }

    public function getWorkerLocks(string $workerId): \Illuminate\Support\Collection
    {
        return EngineeringWorkspaceLock::where('worker_id', $workerId)->get();
    }
}
