<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Illuminate\Support\Facades\DB;
use Modules\System\Engineering\Domain\Enums\AgentStatus;
use Modules\System\Engineering\Domain\Enums\ExecutionSessionStatus;
use Modules\System\Engineering\Domain\Enums\TaskStatus;
use Modules\System\Engineering\Domain\Events\Agent\ExecutionSessionCompleted;
use Modules\System\Engineering\Domain\Events\Agent\ExecutionSessionStarted;
use Modules\System\Engineering\Domain\Models\EngineeringAgent;
use Modules\System\Engineering\Domain\Models\EngineeringExecutionEvent;
use Modules\System\Engineering\Domain\Models\EngineeringTask;
use Modules\System\Engineering\Domain\Models\ExecutionSession;

final class ExecutionSessionService
{
    public function __construct(
        private readonly EngineeringTaskService $taskService,
    ) {}

    public function start(EngineeringAgent $agent, EngineeringTask $task, array $data = []): ExecutionSession
    {
        if ($agent->status !== AgentStatus::Idle) {
            throw new \InvalidArgumentException(
                "Agent [{$agent->id}] must be Idle to start a session (current: {$agent->status->value})."
            );
        }

        if (!in_array($task->status, [TaskStatus::Queued, TaskStatus::Assigned], true)) {
            throw new \InvalidArgumentException(
                "Task [{$task->id}] must be Queued or Assigned to start (current: {$task->status->value})."
            );
        }

        return DB::transaction(function () use ($agent, $task, $data): ExecutionSession {
            $session = ExecutionSession::create([
                'company_id'       => $task->company_id,
                'task_id'          => $task->id,
                'agent_id'         => $agent->id,
                'status'           => ExecutionSessionStatus::Running,
                'started_at'       => now(),
                'workspace_path'   => $data['workspace_path'] ?? null,
                'git_branch'       => $data['git_branch'] ?? null,
                'progress_percent' => 0,
            ]);

            $agent->update(['status' => AgentStatus::Busy]);

            // Walk through intermediate states to reach Running:
            // Queued -> Assigned -> Accepted -> Running
            // Assigned -> Accepted -> Running
            if ($task->status === TaskStatus::Queued) {
                $this->taskService->transition($task, TaskStatus::Assigned);
                $task->refresh();
            }

            if ($task->status === TaskStatus::Assigned) {
                $this->taskService->transition($task, TaskStatus::Accepted);
                $task->refresh();
            }

            $this->taskService->transition($task, TaskStatus::Running);

            event(new ExecutionSessionStarted(
                sessionId: $session->id,
                taskId:    $task->id,
                agentId:   $agent->id,
                companyId: $task->company_id,
            ));

            return $session;
        });
    }

    public function updateProgress(ExecutionSession $session, int $percent, string $message): ExecutionSession
    {
        $session->update([
            'progress_percent' => $percent,
            'progress_message' => $message,
        ]);

        return $session->refresh();
    }

    public function complete(ExecutionSession $session, array $data = []): ExecutionSession
    {
        return DB::transaction(function () use ($session, $data): ExecutionSession {
            $updates = [
                'status'       => ExecutionSessionStatus::Completed,
                'completed_at' => now(),
            ];

            if (array_key_exists('git_commit', $data)) {
                $updates['git_commit'] = $data['git_commit'];
            }

            if (array_key_exists('cpu_seconds_used', $data)) {
                $updates['cpu_seconds_used'] = $data['cpu_seconds_used'];
            }

            if (array_key_exists('memory_mb_peak', $data)) {
                $updates['memory_mb_peak'] = $data['memory_mb_peak'];
            }

            $session->update($updates);
            $session->refresh();

            $session->agent->update(['status' => AgentStatus::Idle]);

            $this->taskService->transition($session->task, TaskStatus::Completed);

            $durationSeconds = $session->started_at
                ? (int) $session->started_at->diffInSeconds($session->completed_at)
                : 0;

            event(new ExecutionSessionCompleted(
                sessionId:       $session->id,
                taskId:          $session->task_id,
                agentId:         $session->agent_id,
                companyId:       $session->company_id,
                durationSeconds: $durationSeconds,
            ));

            return $session;
        });
    }

    public function fail(ExecutionSession $session, string $reason, array $data = []): ExecutionSession
    {
        return DB::transaction(function () use ($session, $reason): ExecutionSession {
            $session->update([
                'status'         => ExecutionSessionStatus::Failed,
                'failed_at'      => now(),
                'failure_reason' => $reason,
            ]);

            $session->agent->update(['status' => AgentStatus::Idle]);

            $this->taskService->transition($session->task, TaskStatus::Failed, $reason);

            return $session->refresh();
        });
    }

    public function abort(ExecutionSession $session): ExecutionSession
    {
        $session->update([
            'status'     => ExecutionSessionStatus::Aborted,
            'aborted_at' => now(),
        ]);

        $session->agent->update(['status' => AgentStatus::Idle]);

        return $session->refresh();
    }

    public function appendLog(
        ExecutionSession $session,
        string $level,
        string $message,
        array $context = [],
    ): void {
        EngineeringExecutionEvent::create([
            'session_id'  => $session->id,
            'event_type'  => 'log',
            'level'       => $level,
            'message'     => $message,
            'context'     => $context ?: null,
            'occurred_at' => now(),
        ]);
    }

    public function dashboard(string $companyId): array
    {
        $agentStats = DB::table('engineering_agents')
            ->where('company_id', $companyId)
            ->whereNull('deleted_at')
            // TASK-GL-HOTFIX-001: `FILTER (WHERE …)` is PostgreSQL-only and raises
            // SQLSTATE 42000 on the MySQL 8.4 this platform deploys.
            ->selectRaw("
                COUNT(CASE WHEN status IN ('idle', 'busy') THEN 1 END) AS connected_agents,
                COUNT(CASE WHEN status = 'busy'            THEN 1 END) AS busy_agents,
                COUNT(CASE WHEN status = 'offline'         THEN 1 END) AS offline_agents
            ")
            ->first();

        $runningTasks = DB::table('engineering_tasks')
            ->where('company_id', $companyId)
            ->whereNull('deleted_at')
            ->where('status', TaskStatus::Running->value)
            ->count();

        $failedExecutions24h = DB::table('engineering_execution_sessions')
            ->where('company_id', $companyId)
            ->where('status', ExecutionSessionStatus::Failed->value)
            ->where('failed_at', '>=', now()->subHours(24))
            ->count();

        $avgRuntimeSeconds = DB::table('engineering_execution_sessions')
            ->where('company_id', $companyId)
            ->where('status', ExecutionSessionStatus::Completed->value)
            ->whereNotNull('started_at')
            ->whereNotNull('completed_at')
            // EXTRACT(EPOCH FROM interval) is PostgreSQL-only. TIMESTAMPDIFF is the
            // MySQL equivalent; there is no ANSI form for interval-to-scalar.
            ->selectRaw('AVG(TIMESTAMPDIFF(SECOND, started_at, completed_at)) AS avg_seconds')
            ->value('avg_seconds');

        $latestActivity = DB::table('engineering_execution_sessions as s')
            ->join('engineering_tasks as t', 't.id', '=', 's.task_id')
            ->join('engineering_agents as a', 'a.id', '=', 's.agent_id')
            ->where('s.company_id', $companyId)
            ->where('s.status', ExecutionSessionStatus::Completed->value)
            ->orderByDesc('s.completed_at')
            ->limit(10)
            ->select([
                's.id',
                's.status',
                's.started_at',
                's.completed_at',
                's.progress_percent',
                't.title as task_title',
                'a.name as agent_name',
            ])
            ->get();

        return [
            'connected_agents'        => (int) ($agentStats->connected_agents ?? 0),
            'busy_agents'             => (int) ($agentStats->busy_agents ?? 0),
            'offline_agents'          => (int) ($agentStats->offline_agents ?? 0),
            'running_tasks'           => $runningTasks,
            'failed_executions_24h'   => $failedExecutions24h,
            'avg_runtime_seconds'     => $avgRuntimeSeconds !== null
                                            ? round((float) $avgRuntimeSeconds, 2)
                                            : null,
            'latest_activity'         => $latestActivity,
        ];
    }
}
