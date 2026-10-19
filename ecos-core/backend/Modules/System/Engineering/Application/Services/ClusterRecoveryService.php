<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Enums\WorkerSessionStatus;
use Modules\System\Engineering\Domain\Enums\WorkerStatus;
use Modules\System\Engineering\Domain\Models\EngineeringClusterEvent;
use Modules\System\Engineering\Domain\Models\EngineeringExecutionQueue;
use Modules\System\Engineering\Domain\Models\EngineeringTask;
use Modules\System\Engineering\Domain\Models\EngineeringWorker;
use Modules\System\Engineering\Domain\Models\EngineeringWorkerSession;

final class ClusterRecoveryService
{
    public function __construct(
        private readonly ClusterScheduler $scheduler,
        private readonly WorkspaceManager $workspaceManager,
        private readonly BranchManager $branchManager,
        private readonly ConflictDetector $conflictDetector,
    ) {}

    public function recoverWorker(EngineeringWorker $worker): bool
    {
        $worker->update(['status' => WorkerStatus::Recovering->value]);
        $this->log($worker->company_id, 'worker_recovered', 'warning', "Recovering worker [{$worker->name}]");

        $this->workspaceManager->releaseAllLocks($worker->id);
        $this->branchManager->releaseAllLocks($worker->id);
        $this->conflictDetector->releaseAllFileLocks($worker->id);

        $terminalValues = array_map(
            fn($s) => $s->value,
            array_filter(WorkerSessionStatus::cases(), fn($s) => $s->isTerminal())
        );

        $activeSessions = EngineeringWorkerSession::where('worker_id', $worker->id)
            ->whereNotIn('status', $terminalValues)
            ->get();

        foreach ($activeSessions as $session) {
            $session->update([
                'status'         => WorkerSessionStatus::Aborted->value,
                'aborted_at'     => now(),
                'failure_reason' => 'Worker crash recovery',
            ]);

            $task = EngineeringTask::find($session->task_id);
            if ($task) {
                $existing = EngineeringExecutionQueue::where('task_id', $task->id)->latest()->first();
                if ($existing) {
                    $this->scheduler->scheduleRetry($existing);
                } else {
                    $this->scheduler->enqueue($task);
                }
            }
        }

        $worker->update([
            'status'             => WorkerStatus::Idle->value,
            'current_task_id'    => null,
            'current_session_id' => null,
        ]);

        $this->log($worker->company_id, 'worker_recovered', 'info', "Worker [{$worker->name}] recovered");
        return true;
    }

    public function purgeExpiredLocks(string $companyId): array
    {
        return [
            'workspace_locks' => $this->workspaceManager->purgeExpiredLocks(),
            'branch_locks'    => $this->branchManager->purgeExpiredLocks(),
            'file_locks'      => $this->conflictDetector->purgeExpiredFileLocks(),
        ];
    }

    public function recoverStaleWorkers(string $companyId): int
    {
        $staleCutoff = now()->subMinutes(5);
        $stale = EngineeringWorker::where('company_id', $companyId)
            ->whereIn('status', ['running', 'preparing', 'reserved'])
            ->where('last_heartbeat_at', '<', $staleCutoff)
            ->get();

        $recovered = 0;
        foreach ($stale as $worker) {
            if ($this->recoverWorker($worker)) {
                $recovered++;
            }
        }
        return $recovered;
    }

    private function log(string $companyId, string $type, string $severity, string $message): void
    {
        EngineeringClusterEvent::create([
            'company_id'  => $companyId,
            'event_type'  => $type,
            'severity'    => $severity,
            'message'     => $message,
            'occurred_at' => now(),
        ]);
    }
}
