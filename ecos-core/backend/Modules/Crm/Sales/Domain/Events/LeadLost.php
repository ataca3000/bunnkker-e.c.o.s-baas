<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Domain\Events;

use Modules\Crm\Shared\Domain\Events\CrmDomainEvent;

/**
 * A lead was closed without converting.
 *
 * Publisher : LeadService::setStatus
 * Trigger   : Status moves to lost.
 */
final class LeadLost extends CrmDomainEvent
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $leadId,
        public readonly ?string $previousStatus = null,
        public readonly ?string $reason = null,
        public readonly ?int $actorId = null,
    ) {
        parent::__construct();
    }

    public function eventName(): string
    {
        return 'crm.lead.lost';
    }

    /** @return array<string, mixed> */
    protected function payload(): array
    {
        return [
            'company_id' => $this->companyId,
            'lead_id' => $this->leadId,
            'previous_status' => $this->previousStatus,
            'reason' => $this->reason,
            'actor_id' => $this->actorId,
        ];
    }
}
