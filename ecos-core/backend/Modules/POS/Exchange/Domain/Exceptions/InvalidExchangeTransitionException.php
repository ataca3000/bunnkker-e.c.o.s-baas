<?php

declare(strict_types=1);

namespace Modules\POS\Exchange\Domain\Exceptions;

use DomainException;
use Modules\POS\Exchange\Domain\Enums\ExchangeStatus;

final class InvalidExchangeTransitionException extends DomainException
{
    public static function cannotTransition(ExchangeStatus $from, ExchangeStatus $to): self
    {
        return new self(
            "Exchange cannot transition from '{$from->label()}' to '{$to->label()}'.",
        );
    }
}
