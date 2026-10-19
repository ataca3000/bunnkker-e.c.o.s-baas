<?php

declare(strict_types=1);

namespace Modules\POS\Application\Services;

use Modules\POS\Application\Commands\OpenCartCommand;
use Modules\POS\Application\Contracts\DomainEventPublisherInterface;
use Modules\POS\Application\Results\OpenCartResult;
use Modules\POS\Cart\Domain\Contracts\CartRepositoryInterface;
use Modules\POS\Cart\Domain\Models\Cart;

final class OpenCartService
{
    public function __construct(
        private readonly CartRepositoryInterface $cartRepo,
        private readonly DomainEventPublisherInterface $publisher,
    ) {}

    public function execute(OpenCartCommand $command): OpenCartResult
    {
        $cart = Cart::open(
            sessionId: $command->sessionId,
            shiftId: $command->shiftId,
            terminalId: $command->terminalId,
            cashierId: $command->cashierId,
            currency: $command->currency,
            customerId: $command->customerId,
        );

        $this->cartRepo->save($cart);

        return new OpenCartResult(cartId: (string) $cart->id);
    }
}
