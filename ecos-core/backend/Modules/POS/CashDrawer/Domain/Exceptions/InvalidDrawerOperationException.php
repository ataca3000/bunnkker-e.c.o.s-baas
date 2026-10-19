<?php

declare(strict_types=1);

namespace Modules\POS\CashDrawer\Domain\Exceptions;

use DomainException;

final class InvalidDrawerOperationException extends DomainException
{
    public static function drawerAlreadyClosed(string $drawerId): self
    {
        return new self(
            "Cannot modify cash drawer '{$drawerId}': drawer is already closed.",
        );
    }

    public static function closingCountRequired(string $drawerId): self
    {
        return new self(
            "Cannot close drawer '{$drawerId}': a closing count must be recorded first.",
        );
    }

    public static function closingCountAlreadyRecorded(string $drawerId): self
    {
        return new self(
            "Cannot record closing count for drawer '{$drawerId}': count has already been recorded.",
        );
    }
}
