<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Application\Services;

use Illuminate\Support\Collection;
use Modules\CustomerEngagement\Domain\Enums\AssignmentType;
use Modules\CustomerEngagement\Domain\Models\AssignmentLog;
use Modules\CustomerEngagement\Domain\Models\Conversation;

class AssignmentService
{
    public function assign(
        Conversation $conv,
        string $assigneeId,
        string $assigneeType,
        AssignmentType $type,
        ?string $assignedBy = null,
        ?string $notes = null,
    ): AssignmentLog {
        // Unassign current
        AssignmentLog::where('conversation_id', $conv->id)
            ->whereNull('unassigned_at')
            ->update(['unassigned_at' => now()]);

        // Update conversation
        $updateData = [];
        if ($assigneeType === 'agent') {
            $updateData['assigned_employee_id'] = $assigneeId;
        } else {
            $updateData['assigned_team_id'] = $assigneeId;
        }
        $conv->update($updateData);

        // Log
        return AssignmentLog::create([
            'conversation_id' => $conv->id,
            'assignee_type' => $assigneeType,
            'assignee_id' => $assigneeId,
            'assigned_by' => $assignedBy,
            'assignment_type' => $type->value,
            'notes' => $notes,
        ]);
    }

    public function unassign(Conversation $conv): void
    {
        AssignmentLog::where('conversation_id', $conv->id)
            ->whereNull('unassigned_at')
            ->update(['unassigned_at' => now()]);

        $conv->update(['assigned_employee_id' => null, 'assigned_team_id' => null]);
    }

    public function getHistory(string $conversationId): Collection
    {
        return AssignmentLog::where('conversation_id', $conversationId)
            ->latest()
            ->get();
    }

    /**
     * Basic round-robin: pick the agent with fewest open conversations.
     * Returns null if no agents available (caller handles manual assignment).
     */
    public function autoAssignRoundRobin(Conversation $conv, array $agentIds): ?AssignmentLog
    {
        if (empty($agentIds)) {
            return null;
        }

        $counts = Conversation::selectRaw('assigned_employee_id, COUNT(*) as cnt')
            ->whereIn('assigned_employee_id', $agentIds)
            ->whereNotIn('status', ['resolved', 'closed'])
            ->groupBy('assigned_employee_id')
            ->pluck('cnt', 'assigned_employee_id')
            ->toArray();

        // Find agent with fewest open conversations (or 0 if not in result)
        $selected = collect($agentIds)->sortBy(fn ($id) => $counts[$id] ?? 0)->first();

        return $this->assign($conv, $selected, 'agent', AssignmentType::RoundRobin);
    }
}
