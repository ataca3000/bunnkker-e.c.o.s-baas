<?php

declare(strict_types=1);

namespace Modules\POS\Payment\Infrastructure\Repositories;

use Modules\POS\Payment\Domain\Contracts\PaymentRepositoryInterface;
use Modules\POS\Payment\Domain\Models\Payment;

final class EloquentPaymentRepository implements PaymentRepositoryInterface
{
    public function findById(string $id): ?Payment
    {
        return Payment::find($id);
    }

    public function findByCartId(string $cartId): ?Payment
    {
        return Payment::where('cart_id', $cartId)->first();
    }

    public function save(Payment $payment): void
    {
        $payment->save();
    }
}
