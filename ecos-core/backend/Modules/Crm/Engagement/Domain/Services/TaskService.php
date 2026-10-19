<?php

declare(strict_types=1);

namespace Modules\Crm\Engagement\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Crm\Engagement\Domain\Enums\TaskStatus;
use Modules\Crm\Engagement\Domain\Enums\TaskType;
use Modules\Crm\Engagement\Domain\Models\CustomerTask;

/**
 * Manages CRM actionables — tasks, follow-ups, appointments and meetings.
 *
 * A task's creation and completion are also written to the append-only activity
 * log, so the timeline records the actionable's lifecycle without the timeline
 * itself ever being rewritten.
 */
final class TaskService
{
    public function __construct(private readonly ActivityService $activities) {}

    /** @param array<string, mixed> $data */
    public function create(string $companyId, string $customerId, TaskType $type, array $data, ?int $actorId = null): CustomerTask
    {
        return DB::transaction(function () use ($companyId, $customerId, $type, $data, $actorId): CustomerTask {
            $task = CustomerTask::create([
                'company_id' => $companyId,
                'customer_id' => $customerId,
                'task_type' => $type->value,
                'title' => $data['title'],
                'description' => $data['description'] ?? null,
                'status' => TaskStatus::Open->value,
                'priority' => $data['priority'] ?? 'normal',
                'due_at' => isset($data['due_at']) ? Carbon::parse($data['due_at']) : null,
                'scheduled_at' => isset($data['scheduled_at']) ? Carbon::parse($data['scheduled_at']) : null,
                'location' => $data['location'] ?? null,
                'assignee_id' => $data['assignee_id'] ?? null,
                'created_by' => $actorId,
            ]);

            $this->activities->system($companyId, $customerId, $type->label().' created: '.$task->title, 'crm_task', (string) $task->id, $actorId);

            return $task;
        });
    }

    public function complete(CustomerTask $task, ?int $actorId = null): CustomerTask
    {
        return DB::transaction(function () use ($task, $actorId): CustomerTask {
            $task->update([
                'status' => TaskStatus::Completed->value,
                'completed_at' => Carbon::now(),
                'completed_by' => $actorId,
            ]);

            $this->activities->system((string) $task->company_id, (string) $task->customer_id, $task->task_type->label().' completed: '.$task->title, 'crm_task', (string) $task->id, $actorId);

            return $task->refresh();
        });
    }

    public function cancel(CustomerTask $task, ?int $actorId = null): CustomerTask
    {
        return DB::transaction(function () use ($task, $actorId): CustomerTask {
            $task->update(['status' => TaskStatus::Cancelled->value]);
            $this->activities->system((string) $task->company_id, (string) $task->customer_id, $task->task_type->label().' cancelled: '.$task->title, 'crm_task', (string) $task->id, $actorId);

            return $task->refresh();
        });
    }
}
