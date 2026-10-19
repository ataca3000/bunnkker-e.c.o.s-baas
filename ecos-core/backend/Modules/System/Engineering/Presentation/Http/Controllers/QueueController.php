<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use DateTime;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\System\Engineering\Application\Services\ClusterScheduler;
use Modules\System\Engineering\Domain\Enums\SchedulingPolicy;
use Modules\System\Engineering\Domain\Models\EngineeringExecutionQueue;
use Modules\System\Engineering\Domain\Models\EngineeringTask;
use Modules\System\Traits\HasApiResponse;

final class QueueController
{
    use HasApiResponse;

    public function __construct(private readonly ClusterScheduler $scheduler) {}

    public function index(Request $request): JsonResponse
    {
        $companyId = auth()->user()->company_id;
        $paginator = $this->scheduler->listQueue(
            $companyId,
            $request->only('status', 'policy'),
            (int) $request->get('page', 1),
            (int) $request->get('per_page', 25),
        );
        return $this->success([
            'data' => $paginator->items(),
            'meta' => [
                'page'      => $paginator->currentPage(),
                'per_page'  => $paginator->perPage(),
                'total'     => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function enqueue(Request $request): JsonResponse
    {
        $data = $request->validate([
            'task_id'            => 'required|uuid|exists:engineering_tasks,id',
            'priority'           => 'nullable|integer|min:0|max:1000',
            'scheduling_policy'  => 'nullable|string',
            'reserved_worker_id' => 'nullable|uuid|exists:engineering_workers,id',
            'earliest_start_at'  => 'nullable|date',
        ]);

        $task = EngineeringTask::findOrFail($data['task_id']);
        abort_if($task->company_id !== auth()->user()->company_id, 403);

        $policy = SchedulingPolicy::tryFrom($data['scheduling_policy'] ?? SchedulingPolicy::Priority->value)
            ?? SchedulingPolicy::Priority;

        $entry = $this->scheduler->enqueue(
            $task,
            $policy,
            $data['priority'] ?? 500,
            $data['reserved_worker_id'] ?? null,
            isset($data['earliest_start_at']) ? new DateTime($data['earliest_start_at']) : null,
        );

        return $this->success(['entry' => $entry], 201);
    }

    public function cancel(Request $request, EngineeringExecutionQueue $entry): JsonResponse
    {
        abort_if($entry->company_id !== auth()->user()->company_id, 403);
        $this->scheduler->cancel($entry, $request->string('reason', ''));
        return $this->success(['message' => 'Queue entry cancelled']);
    }

    public function prioritize(Request $request, EngineeringExecutionQueue $entry): JsonResponse
    {
        abort_if($entry->company_id !== auth()->user()->company_id, 403);
        $data = $request->validate(['priority' => 'required|integer|min:0|max:1000']);
        $this->scheduler->prioritize($entry, $data['priority']);
        return $this->success(['message' => 'Priority updated', 'priority' => $data['priority']]);
    }

    public function status(Request $request): JsonResponse
    {
        return $this->success($this->scheduler->getStatus(auth()->user()->company_id));
    }

    public function pause(Request $request): JsonResponse
    {
        $this->scheduler->pause(auth()->user()->company_id);
        return $this->success(['message' => 'Scheduler paused']);
    }

    public function resume(Request $request): JsonResponse
    {
        $this->scheduler->resume(auth()->user()->company_id);
        return $this->success(['message' => 'Scheduler resumed']);
    }

    public function drain(Request $request): JsonResponse
    {
        $count = $this->scheduler->drain(
            auth()->user()->company_id,
            $request->string('reason', 'Queue drained by operator'),
        );
        return $this->success(['message' => "Drained {$count} queue entries", 'count' => $count]);
    }
}
