<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Domain\Events;

use Modules\Crm\Shared\Domain\Events\CrmDomainEvent;

/**
 * A ticket was escalated.
 *
 * Publisher : TicketService::escalate
 * Trigger   : The ticket breaches or is raised to a higher tier.
 */
final class TicketEscalated extends CrmDomainEvent
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $ticketId,
        public readonly ?string $reason = null,
        public readonly ?string $escalatedTo = null,
        public readonly ?int $actorId = null,
    ) {
        parent::__construct();
    }

    public function eventName(): string
    {
        return 'crm.ticket.escalated';
    }

    /** @return array<string, mixed> */
    protected function payload(): array
    {
        return [
            'company_id' => $this->companyId,
            'ticket_id' => $this->ticketId,
            'reason' => $this->reason,
            'escalated_to' => $this->escalatedTo,
            'actor_id' => $this->actorId,
        ];
    }
}
