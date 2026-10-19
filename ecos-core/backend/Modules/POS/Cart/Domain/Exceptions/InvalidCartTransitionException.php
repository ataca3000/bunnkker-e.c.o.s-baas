<?php

declare(strict_types=1);

namespace Modules\POS\Cart\Domain\Exceptions;

use DomainException;
use Modules\POS\Shared\Domain\Enums\CartStatus;

final class InvalidCartTransitionException extends DomainException
{
    public static function cannotTransition(string $cartId, CartStatus $from, CartStatus $to): self
    {
        return new self(
            "Cart [{$cartId}] cannot transition from \"{$from->value}\" to \"{$to->value}\".",
        );
    }

    public static function alreadyInState(string $cartId, CartStatus $state): self
    {
        return new self("Cart [{$cartId}] is already in state \"{$state->value}\".");
    }

    public static function cartIsEmpty(string $cartId): self
    {
        return new self("Cart [{$cartId}] has no items — cannot proceed to payment.");
    }

    public static function lineNotFound(string $cartId, string $lineId): self
    {
        return new self("Cart [{$cartId}] has no line with ID [{$lineId}].");
    }

    public static function terminalState(string $cartId, CartStatus $state): self
    {
        return new self(
            "Cart [{$cartId}] is in terminal state \"{$state->value}\" and cannot be modified.",
        );
    }
}
