<?php

declare(strict_types=1);

namespace App\Core\Timeline;

use Illuminate\Support\Str;
use Throwable;

final class TimelineService
{
    /**
     * Record a timeline event for any entity.
     *
     * @param  array<string, mixed>  $metadata
     */
    public function record(
        string $companyId,
        string $subjectType,
        string $subjectId,
        string $eventType,
        string $title,
        ?string $description = null,
        ?int $actorId = null,
        ?string $actorName = null,
        string $actorType = 'user',
        array $metadata = [],
        ?string $sourceModule = null,
        ?string $correlationId = null,
    ): void {
        try {
            TimelineEvent::create([
                'id' => Str::uuid()->toString(),
                'company_id' => $companyId,
                'subject_type' => $subjectType,
                'subject_id' => $subjectId,
                'event_type' => $eventType,
                'title' => $title,
                'description' => $description,
                'actor_id' => $actorId,
                'actor_name' => $actorName,
                'actor_type' => $actorType,
                'metadata' => $metadata ?: null,
                'source_module' => $sourceModule,
                'correlation_id' => $correlationId,
                'occurred_at' => now(),
            ]);
        } catch (Throwable) {
            // Timeline writes are non-blocking per INTEGRATION-DESIGN §14.
        }
    }

    /**
     * Get timeline for a subject, newest first.
     *
     * @return \Illuminate\Support\Collection<int, TimelineEvent>
     */
    public function getFor(string $subjectType, string $subjectId, int $limit = 50): \Illuminate\Support\Collection
    {
        return TimelineEvent::where('subject_type', $subjectType)
            ->where('subject_id', $subjectId)
            ->orderByDesc('occurred_at')
            ->limit($limit)
            ->get();
    }
}
