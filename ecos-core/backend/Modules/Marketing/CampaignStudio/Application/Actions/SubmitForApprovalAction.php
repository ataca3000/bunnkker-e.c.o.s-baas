<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Application\Actions;

use Modules\Marketing\CampaignStudio\Application\Services\CampaignApprovalService;
use Modules\Marketing\CampaignStudio\Application\Services\CampaignVersioningService;
use Modules\Marketing\CampaignStudio\Application\Services\ValidationEngineService;
use Modules\Marketing\CampaignStudio\Domain\Enums\VersionChangeType;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignApproval;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignDraft;
use RuntimeException;

class SubmitForApprovalAction
{
    public function __construct(
        private readonly ValidationEngineService $validationEngine,
        private readonly CampaignApprovalService $approvalService,
        private readonly CampaignVersioningService $versioningService,
    ) {}

    public function execute(CampaignDraft $draft, string $userId, ?string $workflowId = null): CampaignApproval
    {
        $validation = $this->validationEngine->validate($draft);

        if (! $validation['can_publish']) {
            throw new RuntimeException("Campaign has {$validation['blocking_errors']} blocking validation error(s). Resolve them before submitting for approval.");
        }

        $this->versioningService->snapshot($draft, VersionChangeType::APPROVAL_DECISION, $userId, 'Submitted for approval');

        return $this->approvalService->submit($draft, $userId, $workflowId);
    }
}
