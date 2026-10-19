<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Domain\Events;

use Modules\Crm\Shared\Domain\Events\CrmDomainEvent;

/**
 * An opportunity closed as lost.
 *
 * Publisher : OpportunityService::lose
 * Trigger   : The deal is marked lost.
 */
final class OpportunityLost extends CrmDomainEvent
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $opportunityId,
        public readonly ?string $customerId = null,
        public readonly ?string $reason = null,
        public readonly ?int $actorId = null,
    ) {
        parent::__construct();
    }

    public function eventName(): string
    {
        return 'crm.opportunity.lost';
    }

    /** @return array<string, mixed> */
    protected function payload(): array
    {
        return [
            'company_id' => $this->companyId,
            'opportunity_id' => $this->opportunityId,
            'customer_id' => $this->customerId,
            'reason' => $this->reason,
            'actor_id' => $this->actorId,
        ];
    }
}
