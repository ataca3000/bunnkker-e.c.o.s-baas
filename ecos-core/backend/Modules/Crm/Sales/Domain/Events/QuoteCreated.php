<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Domain\Events;

use Modules\Crm\Shared\Domain\Events\CrmDomainEvent;

/**
 * A quote was raised.
 *
 * Publisher : QuoteService::create
 * Trigger   : A quote is drafted for an opportunity.
 */
final class QuoteCreated extends CrmDomainEvent
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $quoteId,
        public readonly ?string $opportunityId = null,
        public readonly ?float $total = null,
        public readonly string $currency = 'EGP',
        public readonly ?int $actorId = null,
    ) {
        parent::__construct();
    }

    public function eventName(): string
    {
        return 'crm.quote.created';
    }

    /** @return array<string, mixed> */
    protected function payload(): array
    {
        return [
            'company_id' => $this->companyId,
            'quote_id' => $this->quoteId,
            'opportunity_id' => $this->opportunityId,
            'total' => $this->total,
            'currency' => $this->currency,
            'actor_id' => $this->actorId,
        ];
    }
}
