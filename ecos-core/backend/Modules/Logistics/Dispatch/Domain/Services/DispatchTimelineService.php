<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Modules\Logistics\Dispatch\Domain\Models\DispatchTimelineEvent;

/**
 * The dispatch narrative.
 *
 * Distinct from the audit trail on purpose: the timeline is what a dispatcher
 * reads DURING the morning to understand what is happening; the audit is what a
 * supervisor reads AFTERWARDS to understand what was decided. Merging them
 * would make both worse — the narrative too noisy, the record too thin.
 */
class DispatchTimelineService
{
    /** @param array<string, mixed>|null $metadata */
    public function record(
        string $eventType,
        string $title,
        ?string $description = null,
        string $severity = 'info',
        ?string $companyId = null,
        ?int $boardId = null,
        ?int $sessionId = null,
        ?int $assignmentId = null,
        ?array $metadata = null,
        ?int $actorId = null,
        ?string $actorName = null,
    ): DispatchTimelineEvent {
        return DispatchTimelineEvent::create([
            'company_id' => $companyId,
            'dispatch_board_id' => $boardId,
            'dispatch_session_id' => $sessionId,
            'assignment_id' => $assignmentId,
            'event_type' => $eventType,
            'severity' => $severity,
            'title' => $title,
            'description' => $description,
            'metadata' => $metadata,
            'occurred_at' => Carbon::now(),
            'actor_id' => $actorId,
            'actor_name' => $actorName,
        ]);
    }

    /** @return Collection<int, DispatchTimelineEvent> */
    public function forBoard(int $boardId, int $limit = 100): Collection
    {
        return DispatchTimelineEvent::query()
            ->where('dispatch_board_id', $boardId)
            ->orderByDesc('occurred_at')
            ->limit($limit)
            ->get();
    }

    /** @return Collection<int, DispatchTimelineEvent> */
    public function forSession(int $sessionId, int $limit = 100): Collection
    {
        return DispatchTimelineEvent::query()
            ->where('dispatch_session_id', $sessionId)
            ->orderByDesc('occurred_at')
            ->limit($limit)
            ->get();
    }

    /**
     * Just the problems.
     *
     * The exception feed that leads the operations surface — a timeline of
     * everything is a timeline nobody reads.
     *
     * @return Collection<int, DispatchTimelineEvent>
     */
    public function problems(?string $companyId = null, int $limit = 50): Collection
    {
        return DispatchTimelineEvent::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->whereIn('severity', ['warning', 'critical'])
            ->orderByDesc('occurred_at')
            ->limit($limit)
            ->get();
    }
}
