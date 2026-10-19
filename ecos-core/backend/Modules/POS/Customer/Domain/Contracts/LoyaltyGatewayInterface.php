<?php

declare(strict_types=1);

namespace Modules\POS\Customer\Domain\Contracts;

use Modules\POS\Customer\Domain\Exceptions\InsufficientLoyaltyPointsException;
use Modules\POS\Customer\Domain\ValueObjects\LoyaltyBalance;
use Modules\POS\Shared\Domain\ValueObjects\Money;

interface LoyaltyGatewayInterface
{
    public function getBalance(string $customerId, string $currency): LoyaltyBalance;

    /**
     * Records points earned for a completed sale.
     *
     * @return int number of points actually earned
     */
    public function earnPoints(string $customerId, Money $saleTotal, string $transactionRef): int;

    /**
     * Redeems points and returns their monetary equivalent.
     *
     * @throws InsufficientLoyaltyPointsException
     */
    public function redeemPoints(string $customerId, int $points, string $currency, string $transactionRef): Money;
}
