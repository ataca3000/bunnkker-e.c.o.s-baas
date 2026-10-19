<?php

declare(strict_types=1);

namespace Modules\POS\Customer\Infrastructure\Gateways;

use Modules\POS\Customer\Domain\Contracts\LoyaltyGatewayInterface;
use Modules\POS\Customer\Domain\Exceptions\InsufficientLoyaltyPointsException;
use Modules\POS\Customer\Domain\ValueObjects\LoyaltyBalance;
use Modules\POS\Shared\Domain\ValueObjects\Money;

/**
 * Stub gateway used until a dedicated Loyalty module is built.
 * All customers have zero points; earnPoints is a no-op.
 */
final class NullLoyaltyGateway implements LoyaltyGatewayInterface
{
    public function getBalance(string $customerId, string $currency): LoyaltyBalance
    {
        return LoyaltyBalance::zero($customerId, $currency);
    }

    public function earnPoints(string $customerId, Money $saleTotal, string $transactionRef): int
    {
        return 0;
    }

    public function redeemPoints(string $customerId, int $points, string $currency, string $transactionRef): Money
    {
        if ($points > 0) {
            throw InsufficientLoyaltyPointsException::of($customerId, $points, 0);
        }

        return Money::zero($currency);
    }
}
