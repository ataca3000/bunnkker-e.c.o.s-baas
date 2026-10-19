<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\CustomerEngagement\Application\Actions\AssignConversationAction;
use Modules\CustomerEngagement\Application\Services\AssignmentService;
use Modules\CustomerEngagement\Domain\Models\Conversation;
use Modules\CustomerEngagement\Presentation\Http\Resources\AssignmentLogResource;

class AssignmentController extends Controller
{
    public function __construct(
        private readonly AssignmentService $assignmentService,
        private readonly AssignConversationAction $assignAction,
    ) {}

    public function history(Conversation $conversation): JsonResponse
    {
        $logs = $this->assignmentService->getHistory($conversation->id);

        return response()->json(['data' => AssignmentLogResource::collection($logs)]);
    }

    public function assign(Request $request, Conversation $conversation): JsonResponse
    {
        $data = $request->validate([
            'assignee_id' => 'required|uuid',
            'assignee_type' => 'nullable|string|in:agent,team',
            'assignment_type' => 'nullable|string',
            'assigned_by' => 'nullable|uuid',
            'notes' => 'nullable|string|max:500',
        ]);

        $log = $this->assignAction->execute(
            $conversation,
            $data['assignee_id'],
            $data['assignee_type'] ?? 'agent',
            $data['assignment_type'] ?? 'manual',
            $data['assigned_by'] ?? null,
            $data['notes'] ?? null,
        );

        return response()->json(['data' => new AssignmentLogResource($log)]);
    }

    public function unassign(Conversation $conversation): JsonResponse
    {
        $this->assignmentService->unassign($conversation);

        return response()->json(['success' => true]);
    }

    public function roundRobin(Request $request, Conversation $conversation): JsonResponse
    {
        $request->validate(['agent_ids' => 'required|array|min:1', 'agent_ids.*' => 'uuid']);

        $log = $this->assignmentService->autoAssignRoundRobin($conversation, $request->agent_ids);
        if (! $log) {
            return response()->json(['message' => 'No agents available'], 422);
        }

        return response()->json(['data' => new AssignmentLogResource($log)]);
    }
}
