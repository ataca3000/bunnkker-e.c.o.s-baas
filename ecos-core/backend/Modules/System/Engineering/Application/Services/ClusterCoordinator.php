<?php

declare(strict_types=1);
namespace Modules\System\Engineering\Application\Services;

use Illuminate\Support\Facades\DB;
use Modules\System\Engineering\Domain\Enums\QueueStatus;
use Modules\System\Engineering\Domain\Enums\WorkerStatus;
use Modules\System\Engineering\Domain\Models\EngineeringClusterEvent;
use Modules\System\Engineering\Domain\Models\EngineeringExecutionQueue;
use Modules\System\Engineering\Domain\Models\EngineeringTask;
use Modules\System\Engineering\Domain\Models\EngineeringWorker;
use Modules\System\Engineering\Domain\Models\EngineeringWorkerSession;
use Modules\System\Engineering\Domain\Models\EngineeringWorkspaceLock;
use Modules\System\Engineering\Domain\Models\EngineeringBranchLock;
use Modules\System\Engineering\Domain\Models\EngineeringFileLock;

final class ClusterCoordinator
{
    public function __construct(
        private readonly ClusterScheduler $scheduler,
        private readonly WorkerManager $workerManager,
        private readonly ResourceManager $resourceManager,
        private readonly ConflictDetector $conflictDetector,
    ) {}

    public function tick(string $companyId): array
    {
        $assigned  = 0;
        $skipped   = 0;

        $available = EngineeringWorker::where('company_id', $companyId)
            ->whereIn('status', [WorkerStatus::Idle->value, WorkerStatus::Waiting->value])
            ->get();

        foreach ($available as $worker) {
            if (!$this->resourceManager->canStartNewSession($companyId)) {
                break;
            }
            $entry = $this->scheduler->dequeue($worker);
            if (!$entry) {
                continue;
            }
            $task = EngineeringTask::find($entry->task_id);
            if (!$task) {
                $this->scheduler->cancel($entry, 'Task not found');
                continue;
            }
            if ($this->conflictDetector->hasConflicts($task)) {
                $entry->update([
                    'status'             => QueueStatus::Pending->value,
                    'assigned_worker_id' => null,
                    'assigned_at'        => null,
                    'earliest_start_at'  => now()->addSeconds(30),
                ]);
                $skipped++;
                continue;
            }
            try {
                $this->workerManager->assignTask($worker, $task);
                $entry->update(['status' => QueueStatus::Running->value, 'started_at' => now()]);
                $assigned++;
            } catch (\Throwable) {
                $entry->update([
                    'status'             => QueueStatus::Pending->value,
                    'assigned_worker_id' => null,
                    'assigned_at'        => null,
                ]);
            }
        }

        $recovered = $this->scheduler->recoverDeadWorkerTasks($companyId);

        return ['assigned' => $assigned, 'skipped' => $skipped, 'recovered' => $recovered];
    }

    public function getDashboard(string $companyId): array
    {
        $workers = EngineeringWorker::where('company_id', $companyId)->get();
        $active  = $workers->whereIn('status', ['preparing', 'running', 'paused', 'reserved'])->count();
        $idle    = $workers->whereIn('status', ['idle', 'waiting'])->count();
        $failed  = $workers->where('status', 'failed')->count();
        $offline = $workers->whereIn('status', ['offline', 'stopping', 'destroyed'])->count();

        $queueCounts = EngineeringExecutionQueue::where('company_id', $companyId)
            ->selectRaw('status, COUNT(*) as cnt')
            ->groupBy('status')
            ->pluck('cnt', 'status');

        $snapshot = $this->resourceManager->getLatestSnapshot($companyId);

        $wLocks = EngineeringWorkspaceLock::where('company_id', $companyId)->count();
        $bLocks = EngineeringBranchLock::where('company_id', $companyId)->count();
        $fLocks = EngineeringFileLock::where('company_id', $companyId)->count();

        $recentEvents = EngineeringClusterEvent::where('company_id', $companyId)
            ->orderByDesc('occurred_at')->limit(20)->get();

        $completedToday = EngineeringExecutionQueue::where('company_id', $companyId)
            ->where('completed_at', '>=', now()->startOfDay())->count();
        $failedToday = EngineeringExecutionQueue::where('company_id', $companyId)
            ->where('status', QueueStatus::Expired->value)
            ->where('updated_at', '>=', now()->startOfDay())->count();

        $avgExecSecs = EngineeringWorkerSession::where('company_id', $companyId)
            ->whereNotNull('completed_at')->whereNotNull('started_at')
            ->whereDate('completed_at', today())
            ->selectRaw('AVG(TIMESTAMPDIFF(SECOND, started_at, completed_at)) as avg_secs')
            ->value('avg_secs');

        $hoursToday = max(1, now()->diffInHours(now()->startOfDay()));

        return [
            'workers'  => ['total' => $workers->count(), 'active' => $active, 'idle' => $idle, 'running' => $active, 'failed' => $failed, 'offline' => $offline],
            'queue'    => ['pending' => (int)($queueCounts[QueueStatus::Pending->value] ?? 0), 'assigned' => (int)($queueCounts[QueueStatus::Assigned->value] ?? 0), 'running' => (int)($queueCounts[QueueStatus::Running->value] ?? 0), 'total_today' => $completedToday + $failedToday, 'completed_today' => $completedToday, 'failed_today' => $failedToday, 'avg_wait_seconds' => null],
            'resources'=> $snapshot ? ['cpu_percent' => $snapshot->cpu_percent, 'memory_mb_used' => $snapshot->memory_mb_used, 'disk_gb_used' => $snapshot->disk_gb_used, 'cluster_utilization_percent' => $snapshot->cluster_utilization_percent] : ['cpu_percent' => 0.0, 'memory_mb_used' => 0, 'disk_gb_used' => 0.0, 'cluster_utilization_percent' => 0.0],
            'locks'    => ['workspace_locks' => $wLocks, 'branch_locks' => $bLocks, 'file_locks' => $fLocks, 'conflicts_detected_24h' => EngineeringClusterEvent::where('company_id', $companyId)->where('event_type', 'conflict_detected')->where('occurred_at', '>=', now()->subDay())->count()],
            'recent_events' => $recentEvents,
            'throughput'    => ['tasks_per_hour' => $completedToday > 0 ? round($completedToday / $hoursToday, 2) : 0.0, 'avg_execution_minutes' => $avgExecSecs ? round($avgExecSecs / 60, 2) : null, 'success_rate_percent' => ($completedToday + $failedToday) > 0 ? round($completedToday / ($completedToday + $failedToday) * 100, 2) : 100.0],
        ];
    }
}
