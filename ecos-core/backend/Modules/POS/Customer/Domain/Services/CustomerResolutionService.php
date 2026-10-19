<?php

declare(strict_types=1);

namespace Modules\POS\Customer\Domain\Services;

use Modules\POS\Customer\Domain\Contracts\CustomerGatewayInterface;
use Modules\POS\Customer\Domain\Contracts\LoyaltyGatewayInterface;
use Modules\POS\Customer\Domain\Contracts\StoreCreditGatewayInterface;
use Modules\POS\Customer\Domain\Enums\CustomerLookupType;
use Modules\POS\Customer\Domain\Events\CustomerIdentified;
use Modules\POS\Customer\Domain\Events\LoyaltyPointsEarned;
use Modules\POS\Customer\Domain\Events\LoyaltyPointsRedeemed;
use Modules\POS\Customer\Domain\Events\StoreCreditApplied;
use Modules\POS\Customer\Domain\ValueObjects\CustomerSnapshot;
use Modules\POS\Customer\Domain\ValueObjects\LoyaltyBalance;
use Modules\POS\Customer\Domain\ValueObjects\StoreCreditBalance;
use Modules\POS\Shared\Domain\ValueObjects\Money;

final class CustomerResolutionService
{
    private array $domainEvents = [];

    public function __construct(
        private readonly CustomerGatewayInterface $customerGateway,
        private readonly LoyaltyGatewayInterface $loyaltyGateway,
        private readonly StoreCreditGatewayInterface $storeCreditGateway,
        private readonly CustomerValidator $validator,
    ) {}

    public function identify(string $lookup, CustomerLookupType $type): CustomerSnapshot
    {
        $this->validator->validateLookupValue($lookup, $type);

        $snapshot = match ($type) {
            CustomerLookupType::ById => $this->customerGateway->findById($lookup),
            CustomerLookupType::ByPhone => $this->customerGateway->findByPhone($lookup),
            CustomerLookupType::ByEmail => $this->customerGateway->findByEmail($lookup),
            CustomerLookupType::ByCode => $this->customerGateway->findByCode($lookup),
        };

        $this->domainEvents[] = CustomerIdentified::now(
            customerId: $snapshot->customerId,
            customerCode: $snapshot->customerCode,
            name: $snapshot->name,
            hasEmail: $snapshot->hasEmail(),
            hasPhone: $snapshot->hasPhone(),
            lookupType: $type,
        );

        return $snapshot;
    }

    public function getLoyaltyBalance(string $customerId, string $currency): LoyaltyBalance
    {
        $this->validator->validateCustomerId($customerId);

        return $this->loyaltyGateway->getBalance($customerId, $currency);
    }

    public function getStoreCreditBalance(string $customerId, string $currency): StoreCreditBalance
    {
        $this->validator->validateCustomerId($customerId);

        return $this->storeCreditGateway->getBalance($customerId, $currency);
    }

    public function earnLoyaltyPoints(string $customerId, Money $saleTotal, string $transactionRef): int
    {
        $this->validator->validateCustomerId($customerId);

        $pointsEarned = $this->loyaltyGateway->earnPoints($customerId, $saleTotal, $transactionRef);

        if ($pointsEarned > 0) {
            $this->domainEvents[] = LoyaltyPointsEarned::now(
                customerId: $customerId,
                pointsEarned: $pointsEarned,
                saleTotal: $saleTotal,
                transactionRef: $transactionRef,
            );
        }

        return $pointsEarned;
    }

    public function redeemLoyaltyPoints(
        string $customerId,
        int $points,
        string $currency,
        string $transactionRef,
    ): Money {
        $this->validator->validateCustomerId($customerId);

        $monetaryValue = $this->loyaltyGateway->redeemPoints($customerId, $points, $currency, $transactionRef);

        $this->domainEvents[] = LoyaltyPointsRedeemed::now(
            customerId: $customerId,
            pointsRedeemed: $points,
            monetaryValue: $monetaryValue,
            transactionRef: $transactionRef,
        );

        return $monetaryValue;
    }

    public function applyStoreCredit(string $customerId, Money $amount, string $transactionRef): void
    {
        $this->validator->validateCustomerId($customerId);

        $this->storeCreditGateway->applyCredit($customerId, $amount, $transactionRef);

        $this->domainEvents[] = StoreCreditApplied::now(
            customerId: $customerId,
            amountApplied: $amount,
            transactionRef: $transactionRef,
        );
    }

    public function pullDomainEvents(): array
    {
        $events = $this->domainEvents;
        $this->domainEvents = [];

        return $events;
    }
}
