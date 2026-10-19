<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Modules\System\Engineering\Application\Services\TaskCommentService;
use Modules\System\Engineering\Domain\Models\EngineeringTask;
use Modules\System\Engineering\Domain\Models\EngineeringTaskComment;
use Modules\System\Engineering\Presentation\Http\Resources\TaskCommentResource;

final class InboxCommentController extends Controller
{
    use HasApiResponse;

    public function __construct(
        private readonly TaskCommentService $commentService,
    ) {}

    public function index(EngineeringTask $task): JsonResponse
    {
        $comments = $this->commentService->listForTask($task, includeInternal: true);

        return $this->success([
            'data' => TaskCommentResource::collection($comments),
        ]);
    }

    public function store(Request $request, EngineeringTask $task): JsonResponse
    {
        $data = $request->validate([
            'body'        => ['required', 'string', 'max:5000'],
            'is_internal' => ['sometimes', 'boolean'],
        ]);

        $comment = $this->commentService->create(
            $task,
            Auth::user(),
            $data['body'],
            (bool) ($data['is_internal'] ?? false),
        );

        return $this->success(new TaskCommentResource($comment->load('author')), 201);
    }

    public function update(Request $request, EngineeringTaskComment $comment): JsonResponse
    {
        $data = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $comment = $this->commentService->update($comment, $data['body']);

        return $this->success(new TaskCommentResource($comment->load('author')));
    }

    public function destroy(EngineeringTaskComment $comment): JsonResponse
    {
        $this->commentService->delete($comment);

        return $this->success(['deleted' => true]);
    }
}
