<?php

declare(strict_types=1);

namespace Modules\POS\Application\Services;

use Modules\POS\Application\Exceptions\CartNotFoundException;
use Modules\POS\Cart\Domain\Contracts\CartRepositoryInterface;
use Modules\POS\Cart\Domain\Models\Cart;

final class FindCartService
{
    public function __construct(
        private readonly CartRepositoryInterface $cartRepo,
    ) {}

    public function execute(string $cartId): Cart
    {
        $cart = $this->cartRepo->findById($cartId);

        if ($cart === null) {
            throw CartNotFoundException::withId($cartId);
        }

        return $cart;
    }
}
