<?php

declare(strict_types=1);

namespace Modules\POS\Sale\Domain\Exceptions;

use DomainException;
use Modules\POS\Shared\Domain\Enums\SaleStatus;

final class InvalidSaleTransitionException extends DomainException
{
    public static function notPending(string $saleId, SaleStatus $current): self
    {
        return new self(
            "Sale [{$saleId}] cannot be completed: ".
            "expected \"pending\" but is in \"{$current->value}\" state.",
        );
    }

    public static function cannotVoid(string $saleId, SaleStatus $current): self
    {
        return new self(
            "Sale [{$saleId}] cannot be voided from \"{$current->value}\" state.",
        );
    }

    public static function cannotRefund(string $saleId, SaleStatus $current): self
    {
        return new self(
            "Sale [{$saleId}] cannot be refunded from \"{$current->value}\" state.",
        );
    }

    public static function cannotPartiallyRefund(string $saleId, SaleStatus $current): self
    {
        return new self(
            "Sale [{$saleId}] cannot be partially refunded from \"{$current->value}\" state ".
            '— must be in "completed" state.',
        );
    }
}
