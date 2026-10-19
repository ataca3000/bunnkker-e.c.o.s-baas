<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Domain\Events;

use Modules\Crm\Shared\Domain\Events\CrmDomainEvent;

/**
 * A lead entered the pipeline.
 *
 * Publisher : LeadService::create
 * Trigger   : A new lead is captured.
 */
final class LeadCreated extends CrmDomainEvent
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $leadId,
        public readonly ?string $name = null,
        public readonly ?string $source = null,
        public readonly ?int $actorId = null,
    ) {
        parent::__construct();
    }

    public function eventName(): string
    {
        return 'crm.lead.created';
    }

    /** @return array<string, mixed> */
    protected function payload(): array
    {
        return [
            'company_id' => $this->companyId,
            'lead_id' => $this->leadId,
            'name' => $this->name,
            'source' => $this->source,
            'actor_id' => $this->actorId,
        ];
    }
}
