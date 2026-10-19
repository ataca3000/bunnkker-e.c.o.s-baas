<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Domain\Events;

use Modules\Crm\Shared\Domain\Events\CrmDomainEvent;

/**
 * A quote was rejected.
 *
 * Publisher : QuoteService::reject
 * Trigger   : The customer declines.
 */
final class QuoteRejected extends CrmDomainEvent
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $quoteId,
        public readonly ?string $opportunityId = null,
        public readonly ?string $reason = null,
        public readonly ?int $actorId = null,
    ) {
        parent::__construct();
    }

    public function eventName(): string
    {
        return 'crm.quote.rejected';
    }

    /** @return array<string, mixed> */
    protected function payload(): array
    {
        return [
            'company_id' => $this->companyId,
            'quote_id' => $this->quoteId,
            'opportunity_id' => $this->opportunityId,
            'reason' => $this->reason,
            'actor_id' => $this->actorId,
        ];
    }
}
