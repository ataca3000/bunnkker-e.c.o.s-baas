<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Domain\Events;

use Modules\Crm\Shared\Domain\Events\CrmDomainEvent;

/**
 * A service ticket was raised.
 *
 * Publisher : TicketService::create
 * Trigger   : A customer issue is logged.
 */
final class TicketOpened extends CrmDomainEvent
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $ticketId,
        public readonly ?string $customerId = null,
        public readonly ?string $priority = null,
        public readonly ?string $subject = null,
        public readonly ?int $actorId = null,
    ) {
        parent::__construct();
    }

    public function eventName(): string
    {
        return 'crm.ticket.opened';
    }

    /** @return array<string, mixed> */
    protected function payload(): array
    {
        return [
            'company_id' => $this->companyId,
            'ticket_id' => $this->ticketId,
            'customer_id' => $this->customerId,
            'priority' => $this->priority,
            'subject' => $this->subject,
            'actor_id' => $this->actorId,
        ];
    }
}
