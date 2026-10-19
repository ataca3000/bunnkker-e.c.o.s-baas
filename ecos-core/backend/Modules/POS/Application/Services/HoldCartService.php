<?php

declare(strict_types=1);

namespace Modules\POS\Application\Services;

use Modules\POS\Application\Exceptions\CartNotFoundException;
use Modules\POS\Cart\Domain\Contracts\CartRepositoryInterface;

final class HoldCartService
{
    public function __construct(
        private readonly CartRepositoryInterface $cartRepo,
    ) {}

    public function execute(string $cartId): void
    {
        $cart = $this->cartRepo->findById($cartId);

        if ($cart === null) {
            throw CartNotFoundException::withId($cartId);
        }

        $cart->hold();
        $this->cartRepo->save($cart);
    }
}
