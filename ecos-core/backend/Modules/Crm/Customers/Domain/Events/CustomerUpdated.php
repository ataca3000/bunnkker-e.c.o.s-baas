<?php

declare(strict_types=1);

namespace Modules\Crm\Customers\Domain\Events;

use Modules\Crm\Shared\Domain\Events\CrmDomainEvent;

/**
 * A customer's details changed.
 *
 * Publisher : CustomerService::update
 * Trigger   : Any change to the customer profile.
 */
final class CustomerUpdated extends CrmDomainEvent
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $customerId,
        public readonly array $changedFields = [],
        public readonly ?int $actorId = null,
    ) {
        parent::__construct();
    }

    public function eventName(): string
    {
        return 'crm.customer.updated';
    }

    /** @return array<string, mixed> */
    protected function payload(): array
    {
        return [
            'company_id' => $this->companyId,
            'customer_id' => $this->customerId,
            'changed_fields' => $this->changedFields,
            'actor_id' => $this->actorId,
        ];
    }
}
