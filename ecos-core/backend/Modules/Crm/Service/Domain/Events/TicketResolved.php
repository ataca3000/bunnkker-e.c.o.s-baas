<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Domain\Events;

use Modules\Crm\Shared\Domain\Events\CrmDomainEvent;

/**
 * A ticket was resolved.
 *
 * Publisher : TicketService::transition
 * Trigger   : Status moves to resolved.
 */
final class TicketResolved extends CrmDomainEvent
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $ticketId,
        public readonly ?string $customerId = null,
        public readonly ?string $resolution = null,
        public readonly ?int $actorId = null,
    ) {
        parent::__construct();
    }

    public function eventName(): string
    {
        return 'crm.ticket.resolved';
    }

    /** @return array<string, mixed> */
    protected function payload(): array
    {
        return [
            'company_id' => $this->companyId,
            'ticket_id' => $this->ticketId,
            'customer_id' => $this->customerId,
            'resolution' => $this->resolution,
            'actor_id' => $this->actorId,
        ];
    }
}
