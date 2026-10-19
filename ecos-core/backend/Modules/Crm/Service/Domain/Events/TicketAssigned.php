<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Domain\Events;

use Modules\Crm\Shared\Domain\Events\CrmDomainEvent;

/**
 * A ticket was assigned to an agent.
 *
 * Publisher : TicketService::assign
 * Trigger   : Ownership changes.
 */
final class TicketAssigned extends CrmDomainEvent
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $ticketId,
        public readonly ?int $assigneeId = null,
        public readonly ?int $previousAssigneeId = null,
        public readonly ?int $actorId = null,
    ) {
        parent::__construct();
    }

    public function eventName(): string
    {
        return 'crm.ticket.assigned';
    }

    /** @return array<string, mixed> */
    protected function payload(): array
    {
        return [
            'company_id' => $this->companyId,
            'ticket_id' => $this->ticketId,
            'assignee_id' => $this->assigneeId,
            'previous_assignee_id' => $this->previousAssigneeId,
            'actor_id' => $this->actorId,
        ];
    }
}
