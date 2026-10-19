<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Modules\System\Engineering\Domain\Enums\TaskStatus;
use Modules\System\Engineering\Domain\Models\EngineeringTask;
use Modules\System\Engineering\Domain\Models\EngineeringTaskDependency;

final class TaskDependencyService
{
    private const VALID_TYPES = ['blocks', 'blocked_by', 'related'];

    /**
     * Return all dependencies for the given task, with the dependsOnTask
     * relationship eagerly loaded (id, title, status, priority).
     */
    public function listForTask(EngineeringTask $task): Collection
    {
        return EngineeringTaskDependency::with([
            'dependsOnTask:id,title,status,priority',
        ])
            ->where('task_id', $task->id)
            ->get();
    }

    /**
     * Create a dependency between $task and $dependsOnTask.
     *
     * @throws \InvalidArgumentException When $type is invalid or a circular dependency is detected.
     */
    public function create(
        EngineeringTask $task,
        string          $dependsOnTaskId,
        string          $type = 'blocks',
    ): EngineeringTaskDependency {
        if (! in_array($type, self::VALID_TYPES, true)) {
            throw new \InvalidArgumentException(
                "Invalid dependency type '{$type}'. Allowed: " . implode(', ', self::VALID_TYPES),
            );
        }

        // Circular dependency check: if $task blocks $dependsOnTask, verify
        // that $dependsOnTask does not already block $task (directly or indirectly).
        if ($type === 'blocks') {
            $this->assertNoCycle($task->id, $dependsOnTaskId);
        }

        /** @var \App\Models\User $user */
        $user = Auth::user();

        return EngineeringTaskDependency::create([
            'company_id'         => $task->company_id,
            'task_id'            => $task->id,
            'depends_on_task_id' => $dependsOnTaskId,
            'dependency_type'    => $type,
            'created_by_id'      => $user?->id ?? $task->created_by_id,
        ]);
    }

    /**
     * Hard-delete a dependency record.
     */
    public function delete(EngineeringTaskDependency $dependency): void
    {
        $dependency->delete();
    }

    /**
     * Return true if the task has at least one active 'blocked_by' dependency
     * whose blocking task is not yet completed or cancelled.
     */
    public function isBlocked(EngineeringTask $task): bool
    {
        $terminalStatuses = array_map(
            fn(TaskStatus $s) => $s->value,
            array_filter(TaskStatus::cases(), fn(TaskStatus $s) => $s->isTerminal()),
        );

        return EngineeringTaskDependency::where('task_id', $task->id)
            ->where('dependency_type', 'blocked_by')
            ->whereHas('dependsOnTask', function ($query) use ($terminalStatuses): void {
                $query->whereNotIn('status', $terminalStatuses);
            })
            ->exists();
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Recursively check that making $originTaskId block $dependsOnTaskId
     * would not create a cycle (i.e. $dependsOnTaskId must not already depend
     * on $originTaskId through any chain of 'blocks' relationships).
     *
     * @throws \InvalidArgumentException
     */
    private function assertNoCycle(string $originTaskId, string $dependsOnTaskId): void
    {
        if ($this->hasCycle($originTaskId, $dependsOnTaskId, [])) {
            throw new \InvalidArgumentException(
                "Adding this dependency would create a circular dependency.",
            );
        }
    }

    /**
     * DFS cycle detection.
     *
     * We want to know: starting from $current, can we reach $target by following
     * 'blocks' edges? If yes, the proposed edge ($target → $origin) would form a cycle.
     *
     * @param string   $target   The task that should NOT appear in the chain.
     * @param string   $current  The node we are currently visiting.
     * @param string[] $visited  Already-visited node IDs (loop guard).
     */
    private function hasCycle(string $target, string $current, array $visited): bool
    {
        if ($current === $target) {
            return true;
        }

        if (in_array($current, $visited, true)) {
            return false;
        }

        $visited[] = $current;

        // Find all tasks that $current blocks (i.e. records where task_id = $current, type = blocks)
        $blockedIds = EngineeringTaskDependency::where('task_id', $current)
            ->where('dependency_type', 'blocks')
            ->pluck('depends_on_task_id')
            ->all();

        foreach ($blockedIds as $blockedId) {
            if ($this->hasCycle($target, $blockedId, $visited)) {
                return true;
            }
        }

        return false;
    }
}
