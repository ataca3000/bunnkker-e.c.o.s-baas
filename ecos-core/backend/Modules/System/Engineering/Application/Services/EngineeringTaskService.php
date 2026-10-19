<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Modules\System\Engineering\Domain\Enums\TaskStatus;
use Modules\System\Engineering\Domain\Events\Inbox\TaskCreated;
use Modules\System\Engineering\Domain\Events\Inbox\TaskStatusChanged;
use Modules\System\Engineering\Domain\Events\Inbox\TaskUpdated;
use Modules\System\Engineering\Domain\Models\EngineeringTask;
use Modules\System\Engineering\Domain\Models\EngineeringTaskHistory;

final class EngineeringTaskService
{
    private const TERMINAL_STATUSES = [
        TaskStatus::Completed->value,
        TaskStatus::Failed->value,
        TaskStatus::Cancelled->value,
    ];

    public function list(
        string $companyId,
        array $filters = [],
        int $page = 1,
        int $perPage = 25,
    ): LengthAwarePaginator {
        $query = EngineeringTask::query()
            ->where('company_id', $companyId);

        if (!empty($filters['status'])) {
            $statuses = (array) $filters['status'];
            $query->whereIn('status', $statuses);
        }

        if (!empty($filters['priority'])) {
            $query->where('priority', $filters['priority']);
        }

        if (!empty($filters['assigned_agent_id'])) {
            $query->where('assigned_agent_id', $filters['assigned_agent_id']);
        }

        if (!empty($filters['source_type'])) {
            $query->where('source_type', $filters['source_type']);
        }

        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->where('title', 'LIKE', "%{$search}%");
        }

        if (!empty($filters['overdue'])) {
            $query->where('deadline', '<', now())
                ->whereNotIn('status', self::TERMINAL_STATUSES);
        }

        if (!empty($filters['label_id'])) {
            $labelId = $filters['label_id'];
            $query->whereHas('labels', function ($q) use ($labelId) {
                $q->where('labels.id', $labelId);
            });
        }

        $query->orderByDesc('priority')
            ->orderByDesc('created_at');

        $query->with([
            'agent:id,name',
            'labels',
        ]);

        return $query->paginate($perPage, ['*'], 'page', $page);
    }

    public function create(string $companyId, array $data): EngineeringTask
    {
        $data['company_id']    = $companyId;
        $data['created_by_id'] = Auth::id();
        $data['version']       = 0;

        $task = DB::transaction(function () use ($data) {
            $task = EngineeringTask::create($data);

            $this->recordHistory($task, 'task_created');

            event(new TaskCreated($task));

            return $task;
        });

        return $task;
    }

    public function update(EngineeringTask $task, array $data): EngineeringTask
    {
        DB::transaction(function () use ($task, $data) {
            $task->fill($data);
            $task->version = ($task->version ?? 0) + 1;
            $task->save();

            $this->recordHistory($task, 'task_updated');

            event(new TaskUpdated($task));
        });

        return $task->refresh();
    }

    public function delete(EngineeringTask $task): void
    {
        $task->delete();
    }

    public function transition(
        EngineeringTask $task,
        TaskStatus $newStatus,
        ?string $reason = null,
    ): EngineeringTask {
        if (!$task->canTransitionTo($newStatus)) {
            throw new \InvalidArgumentException(
                "Cannot transition task from [{$task->status->value}] to [{$newStatus->value}]."
            );
        }

        $fromStatus = $task->status->value;

        DB::transaction(function () use ($task, $newStatus, $fromStatus, $reason) {
            $task->status = $newStatus;

            match ($newStatus) {
                TaskStatus::Queued    => $task->queued_at    = now(),
                TaskStatus::Running   => $task->started_at   = now(),
                TaskStatus::Completed => $task->completed_at = now(),
                TaskStatus::Failed    => $task->failed_at    = now(),
                TaskStatus::Cancelled => $task->cancelled_at = now(),
                default               => null,
            };

            $task->version = ($task->version ?? 0) + 1;
            $task->save();

            $this->recordHistory(
                $task,
                'status_changed',
                $fromStatus,
                $newStatus->value,
                $reason,
            );

            event(new TaskStatusChanged($task, $fromStatus, $newStatus->value, $reason));
        });

        return $task->refresh();
    }

    public function assign(EngineeringTask $task, string $agentId): EngineeringTask
    {
        DB::transaction(function () use ($task, $agentId) {
            $fromStatus = $task->status->value;

            $task->assigned_agent_id = $agentId;
            $task->assigned_at       = now();
            $task->status            = TaskStatus::Assigned;
            $task->version           = ($task->version ?? 0) + 1;
            $task->save();

            $this->recordHistory(
                $task,
                'task_assigned',
                $fromStatus,
                TaskStatus::Assigned->value,
            );

            // Fire TaskAssigned if it exists; gracefully skip if not yet defined.
            $eventClass = 'Modules\\System\\Engineering\\Domain\\Events\\Inbox\\TaskAssigned';
            if (class_exists($eventClass)) {
                event(new $eventClass($task));
            }
        });

        return $task->refresh();
    }

    private function recordHistory(
        EngineeringTask $task,
        string $eventType,
        ?string $fromStatus = null,
        ?string $toStatus = null,
        ?string $reason = null,
    ): void {
        EngineeringTaskHistory::create([
            'task_id'      => $task->id,
            'company_id'   => $task->company_id,
            'event_type'   => $eventType,
            'from_status'  => $fromStatus,
            'to_status'    => $toStatus,
            'actor_id'     => Auth::id(),
            'actor_type'   => 'user',
            'reason'       => $reason,
            'occurred_at'  => now(),
        ]);
    }

    public function kpis(string $companyId): array
    {
        $base = fn () => DB::table('engineering_tasks')
            ->where('company_id', $companyId)
            ->whereNull('deleted_at');

        $openTasks = $base()
            ->whereNotIn('status', self::TERMINAL_STATUSES)
            ->count();

        $runningTasks = $base()
            ->where('status', TaskStatus::Running->value)
            ->count();

        $completedTasks = $base()
            ->where('status', TaskStatus::Completed->value)
            ->where('completed_at', '>=', now()->subDays(30))
            ->count();

        $failedTasks = $base()
            ->where('status', TaskStatus::Failed->value)
            ->where('failed_at', '>=', now()->subDays(30))
            ->count();

        $avgCompletionHours = $base()
            ->where('status', TaskStatus::Completed->value)
            ->whereNotNull('started_at')
            ->whereNotNull('completed_at')
            ->selectRaw('AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 3600) as avg_hours')
            ->value('avg_hours');

        $overdueTasks = $base()
            ->where('deadline', '<', now())
            ->whereNotIn('status', self::TERMINAL_STATUSES)
            ->count();

        // Resolve the agent record for the currently authenticated user.
        $myAssignedTasks = 0;
        $userId = Auth::id();

        if ($userId) {
            $agentQuery = DB::table('engineering_agents')
                ->where('company_id', $companyId)
                ->where('user_id', $userId)
                ->whereNull('deleted_at')
                ->value('id');

            if ($agentQuery) {
                $myAssignedTasks = $base()
                    ->where('assigned_agent_id', $agentQuery)
                    ->whereNotIn('status', self::TERMINAL_STATUSES)
                    ->count();
            }
        }

        return [
            'open_tasks'            => $openTasks,
            'running_tasks'         => $runningTasks,
            'completed_tasks'       => $completedTasks,
            'failed_tasks'          => $failedTasks,
            'avg_completion_hours'  => $avgCompletionHours !== null
                                        ? round((float) $avgCompletionHours, 2)
                                        : null,
            'overdue_tasks'         => $overdueTasks,
            'my_assigned_tasks'     => $myAssignedTasks,
        ];
    }
}
