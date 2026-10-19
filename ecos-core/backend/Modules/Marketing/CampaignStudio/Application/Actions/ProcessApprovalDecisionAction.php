<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Application\Actions;

use Modules\Marketing\CampaignStudio\Application\Services\CampaignApprovalService;
use Modules\Marketing\CampaignStudio\Application\Services\CampaignVersioningService;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignApproval;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignApprovalDecision;

class ProcessApprovalDecisionAction
{
    public function __construct(
        private readonly CampaignApprovalService $approvalService,
        private readonly CampaignVersioningService $versioningService,
    ) {}

    public function execute(
        CampaignApproval $approval,
        string $decision,
        string $decidedBy,
        ?string $notes = null,
    ): CampaignApprovalDecision {
        $decisionRecord = $this->approvalService->decide($approval, $decision, $decidedBy, $notes);

        $approval->refresh();
        $this->versioningService->snapshotApprovalDecision(
            $approval->draft,
            $decision,
            $decidedBy,
            $notes,
        );

        return $decisionRecord;
    }
}
