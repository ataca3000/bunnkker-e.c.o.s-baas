<?php

declare(strict_types=1);

namespace Modules\Crm\Loyalty\Domain\Events;

use Modules\Crm\Shared\Domain\Events\CrmDomainEvent;

/**
 * Points were debited from a loyalty account.
 *
 * Publisher : PointsService::record() — the single writer of the loyalty ledger.
 * Trigger   : redeem, spendOnReward, expiry, and a negative adjustment.
 *
 * Redeeming settles an obligation the business already recognised when the
 * points were earned. Earning and redeeming are therefore different accounting
 * events and are published separately — a single "points moved" event would
 * force every consumer to re-derive which one happened.
 *
 * points is reported POSITIVE here: the ledger stores redemptions as a negative
 * signed amount, and a consumer should not have to know that convention to
 * understand how many points left the account.
 */
final class LoyaltyPointsRedeemed extends CrmDomainEvent
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $accountId,
        public readonly ?string $customerId,
        public readonly string $loyaltyTransactionId,
        /** Always positive — the magnitude redeemed. */
        public readonly int $points,
        /** Monetary value of the redemption, when the program defines one. */
        public readonly ?float $amount = null,
        public readonly string $currency = 'EGP',
        public readonly ?string $sourceType = null,
        public readonly ?string $sourceReference = null,
        public readonly ?string $rewardId = null,
        public readonly ?int $actorId = null,
    ) {
        parent::__construct();
    }

    public function eventName(): string
    {
        return 'crm.loyalty.points_redeemed';
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
            'reward_id' => $this->rewardId,
            'actor_id' => $this->actorId,
        ];
    }
}
