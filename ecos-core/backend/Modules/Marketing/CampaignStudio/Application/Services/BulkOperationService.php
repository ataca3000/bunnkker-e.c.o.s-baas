<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Application\Services;

use Modules\Marketing\CampaignStudio\Domain\Enums\BulkOperationType;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignBulkJob;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignDraft;
use RuntimeException;
use Throwable;

class BulkOperationService
{
    public function __construct(
        private readonly PublishingEngineService $publishingEngine,
        private readonly ValidationEngineService $validationEngine,
        private readonly CampaignDraftService $draftService,
    ) {}

    public function queue(
        BulkOperationType $operationType,
        array $draftIds,
        string $queuedBy,
        ?string $companyId = null,
        array $payload = [],
    ): CampaignBulkJob {
        $job = CampaignBulkJob::create([
            'company_id' => $companyId,
            'operation_type' => $operationType,
            'campaign_draft_ids' => $draftIds,
            'operation_payload' => $payload,
            'status' => 'queued',
            'total_count' => count($draftIds),
            'queued_by' => $queuedBy,
        ]);

        // Non-queue operations execute synchronously
        if (! $operationType->requiresQueue()) {
            $this->executeSynchronous($job, $operationType, $draftIds, $payload, $queuedBy);
        }

        return $job->fresh();
    }

    private function executeSynchronous(
        CampaignBulkJob $job,
        BulkOperationType $operationType,
        array $draftIds,
        array $payload,
        string $userId,
    ): void {
        $job->update(['status' => 'processing', 'started_at' => now()]);

        $results = [];
        $successCount = 0;
        $failureCount = 0;

        foreach ($draftIds as $draftId) {
            try {
                $draft = CampaignDraft::find($draftId);
                if (! $draft) {
                    throw new RuntimeException("Draft {$draftId} not found");
                }

                $result = match ($operationType) {
                    BulkOperationType::ASSIGN_INITIATIVE => $this->assignInitiative($draft, $payload['initiative_id'] ?? null, $userId),
                    BulkOperationType::ASSIGN_OWNER => $this->assignOwner($draft, $payload['owner_id'] ?? null, $userId),
                    BulkOperationType::ASSIGN_TAGS => $this->assignTags($draft, $payload['tags'] ?? [], $userId),
                    BulkOperationType::VALIDATE => $this->validationEngine->validate($draft),
                    default => [],
                };

                $results[$draftId] = ['status' => 'success', 'result' => $result];
                $successCount++;
            } catch (Throwable $e) {
                $results[$draftId] = ['status' => 'failed', 'error' => $e->getMessage()];
                $failureCount++;
            }
        }

        $job->update([
            'status' => 'completed',
            'success_count' => $successCount,
            'failure_count' => $failureCount,
            'results' => $results,
            'completed_at' => now(),
        ]);
    }

    private function assignInitiative(CampaignDraft $draft, ?string $initiativeId, string $userId): array
    {
        $draft->update(['initiative_id' => $initiativeId, 'updated_by' => $userId]);

        return ['initiative_id' => $initiativeId];
    }

    private function assignOwner(CampaignDraft $draft, ?string $ownerId, string $userId): array
    {
        $draft->update(['campaign_owner_id' => $ownerId, 'updated_by' => $userId]);

        return ['campaign_owner_id' => $ownerId];
    }

    private function assignTags(CampaignDraft $draft, array $tags, string $userId): array
    {
        $merged = array_unique(array_merge($draft->tags ?? [], $tags));
        $draft->update(['tags' => $merged, 'updated_by' => $userId]);

        return ['tags' => $merged];
    }
}
