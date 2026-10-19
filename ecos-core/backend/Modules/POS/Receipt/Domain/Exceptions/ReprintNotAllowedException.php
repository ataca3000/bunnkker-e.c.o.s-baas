<?php

declare(strict_types=1);

namespace Modules\POS\Receipt\Domain\Exceptions;

use RuntimeException;

final class ReprintNotAllowedException extends RuntimeException
{
    public static function receiptIsVoided(string $receiptNumber): self
    {
        return new self("Cannot reprint voided receipt {$receiptNumber}.");
    }

    public static function reprintLimitReached(string $receiptNumber, int $limit): self
    {
        return new self(
            "Receipt {$receiptNumber} has reached the maximum reprint limit of {$limit}.",
        );
    }
}
