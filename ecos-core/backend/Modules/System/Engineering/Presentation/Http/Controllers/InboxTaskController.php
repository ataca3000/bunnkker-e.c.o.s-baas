<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Modules\System\Engineering\Application\Services\EngineeringTaskService;
use Modules\System\Engineering\Application\Services\TaskCommentService;
use Modules\System\Engineering\Domain\Enums\TaskStatus;
use Modules\System\Engineering\Domain\Models\EngineeringTask;
use Modules\System\Engineering\Presentation\Http\Requests\StoreTaskRequest;
use Modules\System\Engineering\Presentation\Http\Requests\UpdateTaskRequest;
use Modules\System\Engineering\Presentation\Http\Requests\TransitionTaskRequest;
use Modules\System\Engineering\Presentation\Http\Resources\EngineeringTaskResource;

final class InboxTaskController extends Controller
{
    use HasApiResponse;

    public function __construct(
        private readonly EngineeringTaskService $taskService,
        private readonly TaskCommentService $commentService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $companyId = Auth::user()->company_id;

        $filters = array_filter([
            'status'            => $request->input('status'),
            'priority'          => $request->input('priority'),
            'assigned_agent_id' => $request->input('assigned_agent_id'),
            'search'            => $request->input('search'),
            'overdue'           => $request->boolean('overdue') ?: null,
            'label_id'          => $request->input('label_id'),
        ], fn ($v) => $v !== null);

        $paginator = $this->taskService->list(
            $companyId,
            $filters,
            $request->integer('page', 1),
            $request->integer('per_page', 25),
        );

        return $this->success([
            'data' => EngineeringTaskResource::collection($paginator->items()),
            'meta' => [
                'page'     => $paginator->currentPage(),
                'perPage'  => $paginator->perPage(),
                'total'    => $paginator->total(),
                'lastPage' => $paginator->lastPage(),
            ],
        ]);
    }

    public function store(StoreTaskRequest $request): JsonResponse
    {
        $task = $this->taskService->create(
            Auth::user()->company_id,
            $request->validated(),
        );

        return $this->success(
            new EngineeringTaskResource($task->load(['agent', 'labels'])),
            201,
        );
    }

    public function show(EngineeringTask $task): JsonResponse
    {
        $task->load([
            'agent',
            'comments.author',
            'attachments.uploadedBy',
            'dependencies.dependsOnTask',
            'checklists.items',
            'labels',
            'history',
            'activity',
        ]);

        return $this->success(new EngineeringTaskResource($task));
    }

    public function update(UpdateTaskRequest $request, EngineeringTask $task): JsonResponse
    {
        $task = $this->taskService->update($task, $request->validated());

        return $this->success(new EngineeringTaskResource($task));
    }

    public function destroy(EngineeringTask $task): JsonResponse
    {
        $this->taskService->delete($task);

        return $this->success(['deleted' => true]);
    }

    public function transition(TransitionTaskRequest $request, EngineeringTask $task): JsonResponse
    {
        $newStatus = TaskStatus::from($request->validated('status'));

        $task = $this->taskService->transition(
            $task,
            $newStatus,
            $request->validated('reason'),
        );

        return $this->success(new EngineeringTaskResource($task));
    }

    public function kpis(): JsonResponse
    {
        return $this->success(
            $this->taskService->kpis(Auth::user()->company_id),
        );
    }
}
