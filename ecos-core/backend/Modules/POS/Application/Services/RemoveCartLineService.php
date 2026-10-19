<?php

declare(strict_types=1);

namespace Modules\POS\Application\Services;

use Modules\POS\Application\Commands\RemoveCartLineCommand;
use Modules\POS\Application\Exceptions\CartNotFoundException;
use Modules\POS\Cart\Domain\Contracts\CartRepositoryInterface;

final class RemoveCartLineService
{
    public function __construct(
        private readonly CartRepositoryInterface $cartRepo,
    ) {}

    public function execute(RemoveCartLineCommand $command): void
    {
        $cart = $this->cartRepo->findById($command->cartId);

        if ($cart === null) {
            throw CartNotFoundException::withId($command->cartId);
        }

        $cart->removeLine($command->lineId);
        $this->cartRepo->save($cart);
    }
}
