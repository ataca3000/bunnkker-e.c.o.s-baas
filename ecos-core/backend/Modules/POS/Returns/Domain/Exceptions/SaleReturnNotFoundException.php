<?php

declare(strict_types=1);

namespace Modules\POS\Returns\Domain\Exceptions;

use DomainException;

final class SaleReturnNotFoundException extends DomainException
{
    public static function withId(string $id): self
    {
        return new self("Sale return with ID '{$id}' was not found.");
    }

    public static function forReturnNumber(string $returnNumber): self
    {
        return new self("Sale return with return number '{$returnNumber}' was not found.");
    }

    public static function forSale(string $saleId): self
    {
        return new self("No sale returns found for sale '{$saleId}'.");
    }
}
