<?php

declare(strict_types=1);

namespace Modules\Platform\EventPlatform\Application\Services;

use Illuminate\Support\Facades\DB;
use Modules\Platform\EventPlatform\Domain\Contracts\EnterpriseDeadLetterQueueInterface;
use Modules\Platform\EventPlatform\Domain\Models\EventProcessingLog;
use Modules\Platform\EventPlatform\Domain\Models\StoredEvent;

final class EnterpriseEventMonitor
{
    public function __construct(
        private readonly EnterpriseDeadLetterQueueInterface $dlq,
    ) {}

    /**
     * Returns the full monitoring snapshot used by the Event Monitor command.
     */
    public function getSnapshot(?string $companyId = null): array
    {
        $eventQuery = StoredEvent::query();
        if ($companyId) {
            $eventQuery->where('company_id', $companyId);
        }

        $published = (clone $eventQuery)->where('status', 'published')->count();
        $processing = (clone $eventQuery)->where('status', 'processing')->count();
        $succeeded = (clone $eventQuery)->where('status', 'succeeded')->count();
        $failed = (clone $eventQuery)->where('status', 'failed')->count();
        $deadLettered = $this->dlq->count($companyId);
        $replayed = (clone $eventQuery)->where('status', 'replayed')->count();

        $logQuery = EventProcessingLog::query();
        if ($companyId) {
            $logQuery->whereHas('storedEvent', fn ($q) => $q->where('company_id', $companyId));
        }
        $retried = $logQuery->where('attempt_number', '>', 1)->count();

        $avgProcessingMs = $this->getAvgProcessingTimeMs($companyId);
        $subscriberCount = $this->countActiveSubscribers();

        return [
            'published' => $published,
            'processing' => $processing,
            'succeeded' => $succeeded,
            'failed' => $failed,
            'retried' => $retried,
            'dead_letter' => $deadLettered,
            'replayed' => $replayed,
            'avg_processing_ms' => $avgProcessingMs,
            'active_subscribers' => $subscriberCount,
            'generated_at' => now()->toIso8601String(),
        ];
    }

    private function getAvgProcessingTimeMs(?string $companyId): ?float
    {
        $query = DB::table('enterprise_event_processing_log')
            ->where('status', 'succeeded')
            ->whereNotNull('processed_at');

        if ($companyId) {
            $query->whereIn(
                'event_id',
                DB::table('enterprise_events')->where('company_id', $companyId)->select('event_id'),
            );
        }

        $rows = $query->select('created_at', 'processed_at')->limit(1000)->get();

        if ($rows->isEmpty()) {
            return null;
        }

        $total = $rows->sum(fn ($row) => \Carbon\Carbon::parse($row->processed_at)
            ->diffInMilliseconds(\Carbon\Carbon::parse($row->created_at)),
        );

        return round($total / $rows->count(), 2);
    }

    private function countActiveSubscribers(): int
    {
        return DB::table('enterprise_event_processing_log')
            ->distinct('subscriber_class')
            ->count('subscriber_class');
    }
}
