<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Domain\Events;

use Modules\Crm\Shared\Domain\Events\CrmDomainEvent;

/**
 * A lead became a customer and an opportunity.
 *
 * Publisher : LeadService::convert
 * Trigger   : Conversion succeeds. Carries both ids so a consumer can follow the lead into its customer without a lookup.
 */
final class LeadConverted extends CrmDomainEvent
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $leadId,
        public readonly string $customerId,
        public readonly ?string $opportunityId = null,
        public readonly ?int $actorId = null,
    ) {
        parent::__construct();
    }

    public function eventName(): string
    {
        return 'crm.lead.converted';
    }

    /** @return array<string, mixed> */
    protected function payload(): array
    {
        return [
            'company_id' => $this->companyId,
            'lead_id' => $this->leadId,
            'customer_id' => $this->customerId,
            'opportunity_id' => $this->opportunityId,
            'actor_id' => $this->actorId,
        ];
    }
}
