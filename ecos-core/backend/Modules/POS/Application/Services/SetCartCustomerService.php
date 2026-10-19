<?php

declare(strict_types=1);

namespace Modules\POS\Application\Services;

use InvalidArgumentException;
use Modules\POS\Application\Commands\SetCartCustomerCommand;
use Modules\POS\Application\Exceptions\CartNotFoundException;
use Modules\POS\Cart\Domain\Contracts\CartRepositoryInterface;
use Modules\POS\Cart\Domain\Models\Cart;

final class SetCartCustomerService
{
    public function __construct(
        private readonly CartRepositoryInterface $cartRepo,
    ) {}

    public function execute(SetCartCustomerCommand $command): Cart
    {
        $cart = $this->cartRepo->findById($command->cartId);

        if ($cart === null) {
            throw CartNotFoundException::withId($command->cartId);
        }

        if ($cart->status->isTerminal()) {
            throw new InvalidArgumentException(
                "Cannot set customer on a cart in terminal state ({$cart->status->value}).",
            );
        }

        $cart->customer_id = $command->customerId;
        $this->cartRepo->save($cart);

        return $cart;
    }
}
