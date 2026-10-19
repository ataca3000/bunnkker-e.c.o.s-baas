<?php

declare(strict_types=1);

namespace Modules\Crm\Engagement\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Modules\Crm\Customers\Presentation\Http\Controllers\Concerns\ResolvesCustomerContext;
use Modules\Crm\Engagement\Domain\Enums\TaskType;
use Modules\Crm\Engagement\Domain\Models\CustomerTask;
use Modules\Crm\Engagement\Domain\Services\TaskService;

/** Tasks, follow-ups, appointments and meetings. */
class TaskController extends Controller
{
    use ResolvesCustomerContext;

    public function __construct(private readonly TaskService $tasks) {}

    public function index(Request $request, string $id): JsonResponse
    {
        $customer = $this->customer($request, $id);

        $rows = CustomerTask::query()
            ->where('company_id', $this->companyId($request))
            ->where('customer_id', $customer->id)
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->orderByRaw("CASE WHEN status = 'open' THEN 0 ELSE 1 END")
            ->orderBy('due_at')
            ->limit(200)->get()
            ->map(fn (CustomerTask $t) => $this->payload($t));

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'task_type' => ['nullable', Rule::in(TaskType::values())],
            'title' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string'],
            'priority' => ['nullable', Rule::in(['low', 'normal', 'high'])],
            'due_at' => ['nullable', 'date'],
            'scheduled_at' => ['nullable', 'date'],
            'location' => ['nullable', 'string', 'max:200'],
            'assignee_id' => ['nullable', 'integer'],
        ]);

        $customer = $this->customer($request, $id);
        $task = $this->tasks->create(
            $this->companyId($request), (string) $customer->id,
            TaskType::from($validated['task_type'] ?? 'task'), $validated, $this->actorId($request),
        );

        return response()->json(['data' => $this->payload($task)], 201);
    }

    public function complete(Request $request, string $id, string $taskId): JsonResponse
    {
        $task = $this->tasks->complete($this->task($request, $id, $taskId), $this->actorId($request));

        return response()->json(['data' => $this->payload($task)]);
    }

    public function cancel(Request $request, string $id, string $taskId): JsonResponse
    {
        $task = $this->tasks->cancel($this->task($request, $id, $taskId), $this->actorId($request));

        return response()->json(['data' => $this->payload($task)]);
    }

    private function task(Request $request, string $id, string $taskId): CustomerTask
    {
        $customer = $this->customer($request, $id);

        return CustomerTask::query()
            ->where('company_id', $this->companyId($request))
            ->where('customer_id', $customer->id)
            ->where('id', $taskId)
            ->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function payload(CustomerTask $t): array
    {
        return [
            'id' => $t->id,
            'task_type' => $t->task_type->value,
            'title' => $t->title,
            'description' => $t->description,
            'status' => $t->status->value,
            'priority' => $t->priority,
            'due_at' => $t->due_at?->toIso8601String(),
            'scheduled_at' => $t->scheduled_at?->toIso8601String(),
            'location' => $t->location,
            'assignee_id' => $t->assignee_id,
            'completed_at' => $t->completed_at?->toIso8601String(),
        ];
    }
}
