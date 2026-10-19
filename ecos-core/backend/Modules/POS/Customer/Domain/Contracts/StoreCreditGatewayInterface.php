<?php

declare(strict_types=1);

namespace Modules\POS\Customer\Domain\Contracts;

use Modules\POS\Customer\Domain\Exceptions\InsufficientStoreCreditException;
use Modules\POS\Customer\Domain\ValueObjects\StoreCreditBalance;
use Modules\POS\Shared\Domain\ValueObjects\Money;

interface StoreCreditGatewayInterface
{
    public function getBalance(string $customerId, string $currency): StoreCreditBalance;

    /**
     * Applies store credit to a transaction.
     *
     * @throws InsufficientStoreCreditException
     */
    public function applyCredit(string $customerId, Money $amount, string $transactionRef): void;
}
