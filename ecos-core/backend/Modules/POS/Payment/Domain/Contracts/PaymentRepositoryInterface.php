<?php

declare(strict_types=1);

namespace Modules\POS\Payment\Domain\Contracts;

use Modules\POS\Payment\Domain\Models\Payment;

interface PaymentRepositoryInterface
{
    public function findById(string $id): ?Payment;

    public function findByCartId(string $cartId): ?Payment;

    public function save(Payment $payment): void;
}
