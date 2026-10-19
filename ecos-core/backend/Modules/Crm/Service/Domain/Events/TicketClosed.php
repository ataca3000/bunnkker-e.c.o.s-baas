<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Domain\Events;

use Modules\Crm\Shared\Domain\Events\CrmDomainEvent;

/**
 * A ticket was closed.
 *
 * Publisher : TicketService::transition
 * Trigger   : Status moves to closed. Distinct from resolved: a ticket may be closed without a resolution.
 */
final class TicketClosed extends CrmDomainEvent
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $ticketId,
        public readonly ?string $customerId = null,
        public readonly ?int $actorId = null,
    ) {
        parent::__construct();
    }

    public function eventName(): string
    {
        return 'crm.ticket.closed';
    }

    /** @return array<string, mixed> */
    protected function payload(): array
    {
        return [
            'company_id' => $this->companyId,
            'ticket_id' => $this->ticketId,
            'customer_id' => $this->customerId,
            'actor_id' => $this->actorId,
        ];
    }
}
