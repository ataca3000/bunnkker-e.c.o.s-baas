<?php

declare(strict_types=1);
namespace Modules\System\Engineering\Application\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Modules\System\Engineering\Domain\Enums\QueueStatus;
use Modules\System\Engineering\Domain\Enums\SchedulingPolicy;
use Modules\System\Engineering\Domain\Models\EngineeringClusterEvent;
use Modules\System\Engineering\Domain\Models\EngineeringExecutionQueue;
use Modules\System\Engineering\Domain\Models\EngineeringSchedulerEvent;
use Modules\System\Engineering\Domain\Models\EngineeringTask;
use Modules\System\Engineering\Domain\Models\EngineeringWorker;

final class ClusterScheduler
{
    private bool $paused = false;

    public function enqueue(
        EngineeringTask $task,
        SchedulingPolicy $policy = SchedulingPolicy::Priority,
        int $priority = 500,
        ?string $reservedWorkerId = null,
        ?DateTimeInterface $earliestStartAt = null
    ): EngineeringExecutionQueue {
        $terminalValues = array_map(
            fn($s) => $s->value,
            array_filter(SchedulingPolicy::cases(), fn($s) => true)
        );
        $terminalStatuses = array_map(fn($s) => $s->value, array_filter(
            QueueStatus::cases(), fn($s) => $s->isTerminal()
        ));

        $existing = EngineeringExecutionQueue::where('task_id', $task->id)
            ->whereNotIn('status', $terminalStatuses)
            ->first();

        if ($existing) {
            return $existing;
        }

        $entry = EngineeringExecutionQueue::create([
            'company_id'         => $task->company_id,
            'task_id'            => $task->id,
            'priority'           => $priority,
            'status'             => QueueStatus::Pending->value,
            'scheduling_policy'  => $policy->value,
            'reserved_worker_id' => $reservedWorkerId,
            'earliest_start_at'  => $earliestStartAt,
            'enqueued_at'        => now(),
            'max_retries'        => $task->max_retries,
        ]);

        $this->logSchedulerEvent(
            $task->company_id, 'task_queued', $task->id, null, $policy->value,
            "Task [{$task->title}] enqueued with policy [{$policy->value}] at priority [{$priority}]"
        );

        return $entry;
    }

    public function dequeue(EngineeringWorker $worker): ?EngineeringExecutionQueue
    {
        if ($this->paused) {
            return null;
        }

        return DB::transaction(function () use ($worker) {
            $base = EngineeringExecutionQueue::where('company_id', $worker->company_id)
                ->where('status', QueueStatus::Pending->value)
                ->where(fn($q) => $q->whereNull('earliest_start_at')->orWhere('earliest_start_at', '<=', now()))
                ->where(fn($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
                ->lockForUpdate();

            $entry = (clone $base)
                ->where('reserved_worker_id', $worker->id)
                ->orderByDesc('priority')
                ->first();

            if (!$entry) {
                $entry = (clone $base)
                    ->whereNull('reserved_worker_id')
                    ->orderByDesc('priority')
                    ->orderBy('enqueued_at')
                    ->first();
            }

            if (!$entry) {
                return null;
            }

            $entry->update([
                'status'             => QueueStatus::Assigned->value,
                'assigned_worker_id' => $worker->id,
                'assigned_at'        => now(),
            ]);

            $this->logSchedulerEvent(
                $worker->company_id, 'task_assigned', $entry->task_id, $worker->id,
                $entry->scheduling_policy, "Task assigned to worker [{$worker->name}]"
            );

            return $entry->fresh();
        });
    }

    public function cancel(EngineeringExecutionQueue $entry, string $reason = ''): void
    {
        $entry->update([
            'status'              => QueueStatus::Cancelled->value,
            'cancelled_at'        => now(),
            'cancellation_reason' => $reason,
        ]);
        $this->logSchedulerEvent($entry->company_id, 'task_dequeued', $entry->task_id, null, null, "Cancelled: {$reason}");
    }

    public function scheduleRetry(EngineeringExecutionQueue $entry, int $delaySeconds = 60): bool
    {
        if ($entry->retry_count >= $entry->max_retries) {
            $entry->update(['status' => QueueStatus::Expired->value]);
            return false;
        }
        $entry->update([
            'status'             => QueueStatus::Pending->value,
            'retry_count'        => $entry->retry_count + 1,
            'assigned_worker_id' => null,
            'assigned_at'        => null,
            'earliest_start_at'  => now()->addSeconds($delaySeconds),
        ]);
        $this->logSchedulerEvent(
            $entry->company_id, 'retry_scheduled', $entry->task_id, null, null,
            "Retry #{$entry->retry_count} in {$delaySeconds}s"
        );
        return true;
    }

    public function getStatus(string $companyId): array
    {
        $counts = EngineeringExecutionQueue::where('company_id', $companyId)
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        $availableWorkers = EngineeringWorker::where('company_id', $companyId)
            ->whereIn('status', ['idle', 'waiting'])
            ->count();

        $next = EngineeringExecutionQueue::where('company_id', $companyId)
            ->where('status', QueueStatus::Pending->value)
            ->orderByDesc('priority')
            ->orderBy('enqueued_at')
            ->with('task:id,title,status,priority')
            ->first();

        return [
            'is_paused'                 => $this->paused,
            'active_policy'             => SchedulingPolicy::Priority->value,
            'queue_length'              => $counts[QueueStatus::Pending->value] ?? 0,
            'available_workers'         => $availableWorkers,
            'next_scheduled_task'       => $next,
            'tasks_scheduled_last_hour' => EngineeringExecutionQueue::where('company_id', $companyId)
                ->where('assigned_at', '>=', now()->subHour())->count(),
        ];
    }

    public function pause(string $companyId): void
    {
        $this->paused = true;
        $this->logClusterEvent($companyId, 'queue_paused', 'warning', 'Scheduler paused by operator');
    }

    public function resume(string $companyId): void
    {
        $this->paused = false;
        $this->logClusterEvent($companyId, 'queue_resumed', 'info', 'Scheduler resumed by operator');
    }

    public function prioritize(EngineeringExecutionQueue $entry, int $newPriority = 1000): void
    {
        $entry->update(['priority' => $newPriority]);
        $this->logSchedulerEvent($entry->company_id, 'priority_override', $entry->task_id, null, null, "Priority set to {$newPriority}");
    }

    public function drain(string $companyId, string $reason = 'Queue drained by operator'): int
    {
        $count = EngineeringExecutionQueue::where('company_id', $companyId)
            ->where('status', QueueStatus::Pending->value)
            ->update(['status' => QueueStatus::Cancelled->value, 'cancelled_at' => now(), 'cancellation_reason' => $reason]);
        $this->logClusterEvent($companyId, 'queue_drained', 'warning', $reason);
        return $count;
    }

    public function listQueue(string $companyId, array $filters = [], int $page = 1, int $perPage = 25): LengthAwarePaginator
    {
        $q = EngineeringExecutionQueue::where('company_id', $companyId)
            ->with('task:id,title,status,priority', 'assignedWorker:id,name,status');
        if (!empty($filters['status'])) {
            $q->where('status', $filters['status']);
        }
        if (!empty($filters['policy'])) {
            $q->where('scheduling_policy', $filters['policy']);
        }
        return $q->orderByDesc('priority')->orderBy('enqueued_at')->paginate($perPage, ['*'], 'page', $page);
    }

    public function recoverDeadWorkerTasks(string $companyId): int
    {
        $staleCutoff   = now()->subMinutes(10);
        $deadWorkerIds = EngineeringWorker::where('company_id', $companyId)
            ->where(fn($q) => $q
                ->whereIn('status', ['offline', 'failed', 'destroyed'])
                ->orWhere('last_heartbeat_at', '<', $staleCutoff)
            )
            ->pluck('id');

        if ($deadWorkerIds->isEmpty()) {
            return 0;
        }

        $recovered = EngineeringExecutionQueue::where('company_id', $companyId)
            ->whereIn('assigned_worker_id', $deadWorkerIds)
            ->where('status', QueueStatus::Assigned->value)
            ->update([
                'status'             => QueueStatus::Pending->value,
                'assigned_worker_id' => null,
                'assigned_at'        => null,
                'earliest_start_at'  => now()->addSeconds(30),
            ]);

        if ($recovered > 0) {
            $this->logClusterEvent($companyId, 'task_recovery', 'warning', "Recovered {$recovered} tasks from dead workers");
        }

        return $recovered;
    }

    private function logSchedulerEvent(
        string $companyId,
        string $eventType,
        ?string $taskId,
        ?string $workerId,
        ?string $policy,
        string $message
    ): void {
        EngineeringSchedulerEvent::create([
            'company_id'  => $companyId,
            'event_type'  => $eventType,
            'task_id'     => $taskId,
            'worker_id'   => $workerId,
            'policy'      => $policy,
            'message'     => $message,
            'occurred_at' => now(),
        ]);
    }

    private function logClusterEvent(string $companyId, string $eventType, string $severity, string $message): void
    {
        EngineeringClusterEvent::create([
            'company_id'  => $companyId,
            'event_type'  => $eventType,
            'severity'    => $severity,
            'message'     => $message,
            'occurred_at' => now(),
        ]);
    }
}
