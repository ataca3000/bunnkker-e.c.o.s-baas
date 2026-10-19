<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Application\Actions;

use Carbon\Carbon;
use Modules\Marketing\CampaignStudio\Application\Services\CampaignVersioningService;
use Modules\Marketing\CampaignStudio\Application\Services\PublishingEngineService;
use Modules\Marketing\CampaignStudio\Application\Services\ValidationEngineService;
use Modules\Marketing\CampaignStudio\Domain\Enums\CampaignInternalStatus;
use Modules\Marketing\CampaignStudio\Domain\Enums\VersionChangeType;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignDraft;
use Modules\Marketing\CampaignStudio\Domain\Models\PublishingJob;
use RuntimeException;

class PublishCampaignAction
{
    public function __construct(
        private readonly ValidationEngineService $validationEngine,
        private readonly PublishingEngineService $publishingEngine,
        private readonly CampaignVersioningService $versioningService,
    ) {}

    public function execute(
        CampaignDraft $draft,
        string $userId,
        ?Carbon $scheduledAt = null,
    ): PublishingJob {
        if (! in_array($draft->internal_status, [CampaignInternalStatus::APPROVED, CampaignInternalStatus::SCHEDULED, CampaignInternalStatus::DRAFT], true)) {
            throw new RuntimeException("Campaign must be in Approved or Scheduled status to publish. Current: {$draft->internal_status->label()}");
        }

        $validation = $this->validationEngine->validate($draft);
        if (! $validation['can_publish']) {
            throw new RuntimeException("Campaign has {$validation['blocking_errors']} blocking validation error(s). Resolve them before publishing.");
        }

        $job = $this->publishingEngine->queuePublish($draft, $userId, $scheduledAt);

        $this->versioningService->snapshot(
            $draft->fresh(),
            $scheduledAt ? VersionChangeType::SCHEDULE_CHANGE : VersionChangeType::PUBLISHED,
            $userId,
            $scheduledAt ? "Scheduled to publish at {$scheduledAt->toIso8601String()}" : 'Queued for publishing',
        );

        return $job;
    }
}
