<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Domain\Events;

use Modules\Crm\Shared\Domain\Events\CrmDomainEvent;

/**
 * An opportunity moved stage.
 *
 * Publisher : OpportunityService::moveToStage
 * Trigger   : The deal advances or retreats in the pipeline.
 */
final class OpportunityUpdated extends CrmDomainEvent
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $opportunityId,
        public readonly ?string $stageId = null,
        public readonly ?string $previousStageId = null,
        public readonly ?int $actorId = null,
    ) {
        parent::__construct();
    }

    public function eventName(): string
    {
        return 'crm.opportunity.updated';
    }

    /** @return array<string, mixed> */
    protected function payload(): array
    {
        return [
            'company_id' => $this->companyId,
            'opportunity_id' => $this->opportunityId,
            'stage_id' => $this->stageId,
            'previous_stage_id' => $this->previousStageId,
            'actor_id' => $this->actorId,
        ];
    }
}
