<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Modules\System\Engineering\Domain\Models\EngineeringTask;
use Modules\System\Engineering\Domain\Models\EngineeringTaskComment;
use Symfony\Component\HttpKernel\Exception\ForbiddenHttpException;

class TaskCommentService
{
    public function listForTask(EngineeringTask $task, bool $includeInternal = true): Collection
    {
        $query = EngineeringTaskComment::query()
            ->where('task_id', $task->id)
            ->with(['author:id,name,email'])
            ->orderBy('created_at', 'asc');

        if (!$includeInternal) {
            $query->where('is_internal', false);
        }

        return $query->get();
    }

    public function create(EngineeringTask $task, array $data): EngineeringTaskComment
    {
        return EngineeringTaskComment::create([
            'task_id'     => $task->id,
            'company_id'  => $task->company_id,
            'author_id'   => Auth::id(),
            'body'        => $data['body'],
            'is_internal' => (bool) ($data['is_internal'] ?? false),
            'is_system'   => false,
        ]);
    }

    public function createSystemComment(EngineeringTask $task, string $body): EngineeringTaskComment
    {
        return EngineeringTaskComment::create([
            'task_id'     => $task->id,
            'company_id'  => $task->company_id,
            'author_id'   => null,
            'body'        => $body,
            'is_internal' => false,
            'is_system'   => true,
        ]);
    }

    public function update(EngineeringTaskComment $comment, string $body): EngineeringTaskComment
    {
        if ($comment->is_system || (string) $comment->author_id !== (string) Auth::id()) {
            throw new ForbiddenHttpException('You are not allowed to edit this comment.');
        }

        $comment->update(['body' => $body]);

        return $comment->fresh();
    }

    public function delete(EngineeringTaskComment $comment): void
    {
        if ($comment->is_system || (string) $comment->author_id !== (string) Auth::id()) {
            throw new ForbiddenHttpException('You are not allowed to delete this comment.');
        }

        $comment->delete();
    }
}
