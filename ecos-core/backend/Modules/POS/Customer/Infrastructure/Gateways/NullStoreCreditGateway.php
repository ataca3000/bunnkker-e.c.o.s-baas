<?php

declare(strict_types=1);

namespace Modules\POS\Customer\Infrastructure\Gateways;

use Modules\POS\Customer\Domain\Contracts\StoreCreditGatewayInterface;
use Modules\POS\Customer\Domain\Exceptions\InsufficientStoreCreditException;
use Modules\POS\Customer\Domain\ValueObjects\StoreCreditBalance;
use Modules\POS\Shared\Domain\ValueObjects\Money;

/**
 * Stub gateway used until a dedicated Store Credit module is built.
 * All customers have zero store credit; applyCredit rejects any positive amount.
 */
final class NullStoreCreditGateway implements StoreCreditGatewayInterface
{
    public function getBalance(string $customerId, string $currency): StoreCreditBalance
    {
        return StoreCreditBalance::zero($customerId, $currency);
    }

    public function applyCredit(string $customerId, Money $amount, string $transactionRef): void
    {
        if ($amount->isPositive()) {
            throw InsufficientStoreCreditException::of($customerId, $amount, Money::zero($amount->currency));
        }
    }
}
