<?php

declare(strict_types=1);

namespace Modules\Crm\Customers\Domain\Events;

use Modules\Crm\Shared\Domain\Events\CrmDomainEvent;

/**
 * A customer record was created.
 *
 * Publisher : CustomerService::create
 * Trigger   : A new customer is registered, including one minted by lead conversion.
 */
final class CustomerCreated extends CrmDomainEvent
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $customerId,
        public readonly string $customerType,
        public readonly ?string $displayName = null,
        public readonly ?int $actorId = null,
    ) {
        parent::__construct();
    }

    public function eventName(): string
    {
        return 'crm.customer.created';
    }

    /** @return array<string, mixed> */
    protected function payload(): array
    {
        return [
            'company_id' => $this->companyId,
            'customer_id' => $this->customerId,
            'customer_type' => $this->customerType,
            'display_name' => $this->displayName,
            'actor_id' => $this->actorId,
        ];
    }
}
