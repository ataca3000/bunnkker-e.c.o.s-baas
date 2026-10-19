<?php

declare(strict_types=1);
namespace Modules\System\Engineering\Application\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Modules\System\Engineering\Domain\Enums\WorkerStatus;
use Modules\System\Engineering\Domain\Enums\WorkerSessionStatus;
use Modules\System\Engineering\Domain\Models\EngineeringClusterEvent;
use Modules\System\Engineering\Domain\Models\EngineeringTask;
use Modules\System\Engineering\Domain\Models\EngineeringWorker;
use Modules\System\Engineering\Domain\Models\EngineeringWorkerSession;

final class WorkerManager
{
    public function __construct(
        private readonly WorkspaceManager $workspaceManager,
        private readonly BranchManager $branchManager,
        private readonly ConflictDetector $conflictDetector,
    ) {}

    public function create(string $companyId, array $data): EngineeringWorker
    {
        $worker = EngineeringWorker::create(array_merge($data, [
            'company_id'        => $companyId,
            'status'            => WorkerStatus::Offline->value,
            'last_heartbeat_at' => now(),
        ]));
        $this->log($companyId, 'worker_started', 'info', "Worker [{$worker->name}] created");
        return $worker;
    }

    public function start(EngineeringWorker $worker): EngineeringWorker
    {
        $worker->update(['status' => WorkerStatus::Starting->value, 'started_at' => now()]);
        $worker->update(['status' => WorkerStatus::Idle->value]);
        $this->log($worker->company_id, 'worker_started', 'info', "Worker [{$worker->name}] now idle");
        return $worker->fresh();
    }

    public function assignTask(
        EngineeringWorker $worker,
        EngineeringTask $task,
        string $repositoryPath = '',
        string $baseBranch = 'main'
    ): EngineeringWorkerSession {
        return DB::transaction(function () use ($worker, $task, $repositoryPath, $baseBranch) {
            $branchName    = 'feature/task-' . $task->id;
            $workspacePath = $this->workspaceManager->provision($worker, $task);

            if ($this->conflictDetector->hasConflicts($task, $repositoryPath, $workspacePath)) {
                throw new \RuntimeException("Task [{$task->id}] has conflicts and cannot be executed now");
            }

            $this->workspaceManager->acquireLock($worker, $task, $workspacePath);

            if (!empty($repositoryPath)) {
                $this->branchManager->acquireLock($worker, $task, $repositoryPath, $branchName);
            }

            $session = EngineeringWorkerSession::create([
                'company_id'     => $worker->company_id,
                'worker_id'      => $worker->id,
                'task_id'        => $task->id,
                'status'         => WorkerSessionStatus::Preparing->value,
                'workspace_path' => $workspacePath,
                'git_branch'     => !empty($repositoryPath) ? $branchName : null,
                'started_at'     => now(),
            ]);

            $worker->update([
                'status'             => WorkerStatus::Preparing->value,
                'current_task_id'    => $task->id,
                'current_session_id' => $session->id,
            ]);

            $this->log($worker->company_id, 'worker_started', 'info', "Worker [{$worker->name}] preparing [{$task->title}]");
            return $session;
        });
    }

    public function markRunning(EngineeringWorkerSession $session): void
    {
        $session->update(['status' => WorkerSessionStatus::Running->value]);
        $session->worker->update(['status' => WorkerStatus::Running->value]);
    }

    public function completeSession(EngineeringWorkerSession $session, array $data = []): void
    {
        DB::transaction(function () use ($session, $data) {
            $session->update(array_merge(['status' => WorkerSessionStatus::Completed->value, 'completed_at' => now()], $data));
            $worker = $session->worker;
            $this->workspaceManager->releaseLock($worker->id, $session->workspace_path ?? '');
            $this->branchManager->releaseAllLocks($worker->id);
            $this->conflictDetector->releaseAllFileLocks($worker->id);
            $worker->update([
                'status'                 => WorkerStatus::Idle->value,
                'current_task_id'        => null,
                'current_session_id'     => null,
                'total_tasks_completed'  => $worker->total_tasks_completed + 1,
            ]);
            $this->log($worker->company_id, 'worker_started', 'info', "Worker [{$worker->name}] completed task; idle");
        });
    }

    public function failSession(EngineeringWorkerSession $session, string $reason): void
    {
        DB::transaction(function () use ($session, $reason) {
            $session->update(['status' => WorkerSessionStatus::Failed->value, 'failed_at' => now(), 'failure_reason' => $reason]);
            $worker = $session->worker;
            $this->workspaceManager->releaseLock($worker->id, $session->workspace_path ?? '');
            $this->branchManager->releaseAllLocks($worker->id);
            $this->conflictDetector->releaseAllFileLocks($worker->id);
            $worker->update([
                'status'              => WorkerStatus::Failed->value,
                'total_tasks_failed'  => $worker->total_tasks_failed + 1,
                'current_task_id'     => null,
                'current_session_id'  => null,
            ]);
            $this->log($worker->company_id, 'worker_crashed', 'error', "Worker [{$worker->name}] failed: {$reason}");
        });
    }

    public function stop(EngineeringWorker $worker): void
    {
        $worker->update(['status' => WorkerStatus::Stopping->value]);
        $worker->update(['status' => WorkerStatus::Offline->value, 'stopped_at' => now()]);
        $this->log($worker->company_id, 'worker_stopped', 'info', "Worker [{$worker->name}] stopped");
    }

    public function drain(EngineeringWorker $worker): void
    {
        $worker->update(['status' => WorkerStatus::Stopping->value]);
        $this->log($worker->company_id, 'worker_stopped', 'info', "Worker [{$worker->name}] draining");
    }

    public function destroy(EngineeringWorker $worker): void
    {
        $this->stop($worker);
        $worker->update(['status' => WorkerStatus::Destroyed->value]);
        $worker->delete();
    }

    public function list(string $companyId, array $filters = [], int $page = 1, int $perPage = 25): LengthAwarePaginator
    {
        $q = EngineeringWorker::where('company_id', $companyId)
            ->with('currentTask:id,title,status', 'currentSession:id,status,progress_percent,started_at');
        if (!empty($filters['status'])) {
            $q->whereIn('status', (array) $filters['status']);
        }
        if (!empty($filters['worker_type'])) {
            $q->where('worker_type', $filters['worker_type']);
        }
        return $q->orderBy('name')->paginate($perPage, ['*'], 'page', $page);
    }

    public function updateProgress(EngineeringWorkerSession $session, int $percent, string $message): void
    {
        $session->update(['progress_percent' => $percent, 'progress_message' => $message]);
    }

    public function heartbeat(EngineeringWorker $worker, array $metrics = []): void
    {
        $update = ['last_heartbeat_at' => now()];
        if (!empty($metrics['status'])) {
            $newStatus = WorkerStatus::from($metrics['status']);
            if ($worker->status->canTransitionTo($newStatus)) {
                $update['status'] = $newStatus->value;
            }
        }
        $worker->update($update);
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
