<?php

declare(strict_types=1);

namespace Modules\POS\Cart\Domain\Contracts;

use Modules\POS\Cart\Domain\Models\Cart;

interface CartRepositoryInterface
{
    public function findById(string $id): ?Cart;

    public function findActiveBySession(string $sessionId): ?Cart;

    /** @return Cart[] */
    public function findHeldBySession(string $sessionId): array;

    public function save(Cart $cart): void;
}
