<?php

declare(strict_types=1);

namespace Modules\Crm\Customers\Domain\Events;

use Modules\Crm\Shared\Domain\Events\CrmDomainEvent;

/**
 * Two customer records were merged into one.
 *
 * Publisher : CustomerMergeService::merge
 * Trigger   : A duplicate is folded into a surviving record. Consumers holding the losing id must repoint to the winner.
 */
final class CustomerMerged extends CrmDomainEvent
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $winnerCustomerId,
        public readonly string $loserCustomerId,
        public readonly ?int $actorId = null,
    ) {
        parent::__construct();
    }

    public function eventName(): string
    {
        return 'crm.customer.merged';
    }

    /** @return array<string, mixed> */
    protected function payload(): array
    {
        return [
            'company_id' => $this->companyId,
            'winner_customer_id' => $this->winnerCustomerId,
            'loser_customer_id' => $this->loserCustomerId,
            'actor_id' => $this->actorId,
        ];
    }
}
