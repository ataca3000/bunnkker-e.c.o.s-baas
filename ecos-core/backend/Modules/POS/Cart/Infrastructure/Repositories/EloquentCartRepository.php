<?php

declare(strict_types=1);

namespace Modules\POS\Cart\Infrastructure\Repositories;

use Modules\POS\Cart\Domain\Contracts\CartRepositoryInterface;
use Modules\POS\Cart\Domain\Models\Cart;
use Modules\POS\Shared\Domain\Enums\CartStatus;

final class EloquentCartRepository implements CartRepositoryInterface
{
    public function findById(string $id): ?Cart
    {
        return Cart::find($id);
    }

    public function findActiveBySession(string $sessionId): ?Cart
    {
        return Cart::where('session_id', $sessionId)
            ->where('status', CartStatus::Active->value)
            ->first();
    }

    /** @return Cart[] */
    public function findHeldBySession(string $sessionId): array
    {
        return Cart::where('session_id', $sessionId)
            ->where('status', CartStatus::Held->value)
            ->orderBy('held_at')
            ->get()
            ->all();
    }

    public function save(Cart $cart): void
    {
        $cart->save();
    }
}
