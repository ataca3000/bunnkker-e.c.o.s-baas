<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Domain\Events;

use Modules\Crm\Shared\Domain\Events\CrmDomainEvent;

/**
 * An opportunity closed as won.
 *
 * Publisher : OpportunityService::win
 * Trigger   : The deal is marked won.
 */
final class OpportunityWon extends CrmDomainEvent
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $opportunityId,
        public readonly ?string $customerId = null,
        public readonly ?float $amount = null,
        public readonly string $currency = 'EGP',
        public readonly ?int $actorId = null,
    ) {
        parent::__construct();
    }

    public function eventName(): string
    {
        return 'crm.opportunity.won';
    }

    /** @return array<string, mixed> */
    protected function payload(): array
    {
        return [
            'company_id' => $this->companyId,
            'opportunity_id' => $this->opportunityId,
            'customer_id' => $this->customerId,
            'amount' => $this->amount,
            'currency' => $this->currency,
            'actor_id' => $this->actorId,
        ];
    }
}
