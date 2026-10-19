<?php

declare(strict_types=1);

namespace Modules\Crm\Customers\Domain\Events;

use Modules\Crm\Shared\Domain\Events\CrmDomainEvent;

/**
 * A customer was archived and is no longer active.
 *
 * Publisher : CustomerService::setStatus
 * Trigger   : Status moves to archived.
 */
final class CustomerArchived extends CrmDomainEvent
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $customerId,
        public readonly ?string $previousStatus = null,
        public readonly ?int $actorId = null,
    ) {
        parent::__construct();
    }

    public function eventName(): string
    {
        return 'crm.customer.archived';
    }

    /** @return array<string, mixed> */
    protected function payload(): array
    {
        return [
            'company_id' => $this->companyId,
            'customer_id' => $this->customerId,
            'previous_status' => $this->previousStatus,
            'actor_id' => $this->actorId,
        ];
    }
}
