<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Application\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Marketing\CampaignStudio\Domain\Enums\CampaignInternalStatus;
use Modules\Marketing\CampaignStudio\Domain\Enums\PublishingJobStatus;
use Modules\Marketing\CampaignStudio\Domain\Enums\PublishingOperation;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignDraft;
use Modules\Marketing\CampaignStudio\Domain\Models\PublishingJob;

/**
 * Publishing ALWAYS goes through the Connector Framework.
 * This service queues jobs; the connector executes them asynchronously.
 */
class PublishingEngineService
{
    public function queuePublish(CampaignDraft $draft, string $queuedBy, ?Carbon $scheduledAt = null): PublishingJob
    {
        $payload = $this->buildPublishPayload($draft);

        return DB::transaction(function () use ($draft, $queuedBy, $scheduledAt, $payload): PublishingJob {
            $job = PublishingJob::create([
                'campaign_draft_id' => $draft->id,
                'operation' => PublishingOperation::PUBLISH,
                'status' => PublishingJobStatus::QUEUED,
                'connector_type' => $draft->connector_type,
                'connection_id' => $draft->connection_id,
                'payload' => $payload,
                'max_attempts' => 3,
                'scheduled_at' => $scheduledAt,
                'scheduled_timezone' => $draft->timezone,
                'queued_by' => $queuedBy,
            ]);

            $status = $scheduledAt
                ? CampaignInternalStatus::SCHEDULED
                : CampaignInternalStatus::PUBLISHING;

            $draft->update([
                'internal_status' => $status,
                'scheduled_publish_at' => $scheduledAt,
            ]);

            return $job;
        });
    }

    public function queueOperation(
        CampaignDraft $draft,
        PublishingOperation $operation,
        string $queuedBy,
        array $extraPayload = [],
    ): PublishingJob {
        $job = PublishingJob::create([
            'campaign_draft_id' => $draft->id,
            'operation' => $operation,
            'status' => PublishingJobStatus::QUEUED,
            'connector_type' => $draft->connector_type,
            'connection_id' => $draft->connection_id,
            'payload' => array_merge(['external_campaign_id' => $draft->external_campaign_id], $extraPayload),
            'max_attempts' => 3,
            'queued_by' => $queuedBy,
        ]);

        $newStatus = match ($operation) {
            PublishingOperation::PAUSE => CampaignInternalStatus::PAUSED,
            PublishingOperation::RESUME => CampaignInternalStatus::PUBLISHING,
            PublishingOperation::ARCHIVE => CampaignInternalStatus::ARCHIVED,
            default => $draft->internal_status,
        };

        $draft->update(['internal_status' => $newStatus]);

        return $job;
    }

    public function markCompleted(PublishingJob $job, array $result): void
    {
        $job->update([
            'status' => PublishingJobStatus::COMPLETED,
            'result' => $result,
            'completed_at' => now(),
        ]);

        if ($job->operation === PublishingOperation::PUBLISH) {
            $job->draft->update([
                'internal_status' => CampaignInternalStatus::PUBLISHED,
                'external_campaign_id' => $result['external_campaign_id'] ?? null,
                'external_account_id' => $result['external_account_id'] ?? null,
                'published_at' => now(),
                'last_published_at' => now(),
            ]);
        }
    }

    public function markFailed(PublishingJob $job, string $errorMessage, array $context = []): void
    {
        $newAttempt = $job->attempt_count + 1;
        $canRetry = $newAttempt < $job->max_attempts;

        $job->update([
            'status' => $canRetry ? PublishingJobStatus::RETRYING : PublishingJobStatus::FAILED,
            'error_message' => $errorMessage,
            'error_context' => $context,
            'attempt_count' => $newAttempt,
            'next_retry_at' => $canRetry ? now()->addMinutes(5 * $newAttempt) : null,
        ]);

        if (! $canRetry && $job->operation === PublishingOperation::PUBLISH) {
            $job->draft->update(['internal_status' => CampaignInternalStatus::FAILED]);
        }
    }

    public function retry(PublishingJob $job, string $retriedBy): PublishingJob
    {
        $job->update([
            'status' => PublishingJobStatus::QUEUED,
            'next_retry_at' => null,
            'error_message' => null,
            'queued_by' => $retriedBy,
        ]);

        return $job->fresh();
    }

    public function getQueueStats(array $filters = []): array
    {
        $query = PublishingJob::query();
        if ($companyId = ($filters['company_id'] ?? null)) {
            $query->whereHas('draft', fn ($q) => $q->where('company_id', $companyId));
        }

        $counts = $query->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return [
            'queued' => (int) ($counts['queued'] ?? 0),
            'processing' => (int) ($counts['processing'] ?? 0),
            'completed' => (int) ($counts['completed'] ?? 0),
            'failed' => (int) ($counts['failed'] ?? 0),
            'retrying' => (int) ($counts['retrying'] ?? 0),
        ];
    }

    private function buildPublishPayload(CampaignDraft $draft): array
    {
        $draft->loadMissing(['audience', 'creatives', 'placement']);

        return [
            'campaign_draft_id' => $draft->id,
            'connector_type' => $draft->connector_type,
            'ad_account_id' => $draft->ad_account_id,
            'name' => $draft->name,
            'objective' => $draft->objective,
            'buying_type' => $draft->buying_type,
            'budget_type' => $draft->budget_type?->value,
            'daily_budget' => $draft->daily_budget,
            'lifetime_budget' => $draft->lifetime_budget,
            'bid_strategy' => $draft->bid_strategy,
            'optimization_goal' => $draft->optimization_goal,
            'start_date' => $draft->start_date?->toIso8601String(),
            'end_date' => $draft->end_date?->toIso8601String(),
            'page_id' => $draft->page_id,
            'instagram_account_id' => $draft->instagram_account_id,
            'pixel_id' => $draft->pixel_id,
            'catalog_id' => $draft->catalog_id,
            'audience' => $draft->audience?->raw_targeting ?? $draft->audience?->toArray(),
            'creatives' => $draft->creatives->map->toArray()->values()->all(),
            'placements' => $draft->placement?->getEnabledPlacements(),
        ];
    }
}
