<?php

declare(strict_types=1);

namespace Modules\POS\Receipt\Domain\Exceptions;

use RuntimeException;

final class ReceiptNotFoundException extends RuntimeException
{
    public static function withId(string $id): self
    {
        return new self("Receipt not found with ID: {$id}.");
    }

    public static function withNumber(string $receiptNumber): self
    {
        return new self("Receipt not found with number: {$receiptNumber}.");
    }
}
