<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Crm\Sales\Domain\Enums\SalesActivityType;
use Modules\Crm\Sales\Domain\Models\SalesActivity;

/**
 * Sales activities, reminders and follow-ups on a lead or opportunity. Reminders
 * and follow-ups are forward-looking; the due feed powers agents' work queues.
 */
final class SalesActivityService
{
    /** @param array<string, mixed> $data */
    public function create(string $companyId, string $subjectType, string $subjectId, SalesActivityType $type, array $data, ?int $actorId = null): SalesActivity
    {
        return SalesActivity::create([
            'company_id' => $companyId,
            'subject_type' => $subjectType,
            'subject_id' => $subjectId,
            'activity_type' => $type->value,
            'title' => $data['title'],
            'body' => $data['body'] ?? null,
            'status' => 'planned',
            'due_at' => isset($data['due_at']) ? Carbon::parse($data['due_at']) : null,
            'remind_at' => isset($data['remind_at']) ? Carbon::parse($data['remind_at']) : null,
            'assignee_id' => $data['assignee_id'] ?? $actorId,
            'created_by' => $actorId,
        ]);
    }

    public function complete(SalesActivity $activity): SalesActivity
    {
        $activity->update(['status' => 'done', 'completed_at' => Carbon::now()]);

        return $activity->refresh();
    }

    public function cancel(SalesActivity $activity): SalesActivity
    {
        $activity->update(['status' => 'cancelled']);

        return $activity->refresh();
    }

    /**
     * Reminders/follow-ups due on or before a moment — the agent's work queue.
     *
     * @return \Illuminate\Support\Collection<int, SalesActivity>
     */
    public function due(string $companyId, ?Carbon $before = null, ?int $assigneeId = null)
    {
        $before ??= Carbon::now();

        return SalesActivity::query()
            ->where('company_id', $companyId)
            ->where('status', 'planned')
            ->whereNotNull('due_at')
            ->where('due_at', '<=', $before)
            ->when($assigneeId !== null, fn ($q) => $q->where('assignee_id', $assigneeId))
            ->orderBy('due_at')
            ->get();
    }
}
