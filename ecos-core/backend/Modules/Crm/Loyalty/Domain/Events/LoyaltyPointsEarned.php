<?php

declare(strict_types=1);

namespace Modules\Crm\Loyalty\Domain\Events;

use Modules\Crm\Shared\Domain\Events\CrmDomainEvent;

/**
 * Points were credited to a loyalty account.
 *
 * Publisher : PointsService::record() — the single writer of the loyalty ledger,
 *             so this fires exactly once per credited transaction and cannot be
 *             duplicated by a second code path.
 * Trigger   : earn, earnForSpend, and a positive adjustment.
 *
 * Earning points creates an obligation to the customer, which is why Finance
 * treats it as an expense against a liability. This event is what lets it: the
 * posting rule crm.loyalty_earn has existed all along with nothing to fire it.
 */
final class LoyaltyPointsEarned extends CrmDomainEvent
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $accountId,
        public readonly ?string $customerId,
        public readonly string $loyaltyTransactionId,
        public readonly int $points,
        /** Monetary value of the points, when the program defines one. */
        public readonly ?float $amount = null,
        public readonly string $currency = 'EGP',
        public readonly ?string $sourceType = null,
        /** An opaque reference to whatever caused the earn. CRM copies nothing from it. */
        public readonly ?string $sourceReference = null,
        public readonly ?int $actorId = null,
    ) {
        parent::__construct();
    }

    public function eventName(): string
    {
        return 'crm.loyalty.points_earned';
    }

    /** @return array<string, mixed> */
    protected function payload(): array
    {
        return [
            'company_id' => $this->companyId,
            'account_id' => $this->accountId,
            'customer_id' => $this->customerId,
            'loyalty_transaction_id' => $this->loyaltyTransactionId,
            'points' => $this->points,
            'amount' => $this->amount,
            'currency' => $this->currency,
            'source_type' => $this->sourceType,
            'source_reference' => $this->sourceReference,
            'actor_id' => $this->actorId,
        ];
    }
}
