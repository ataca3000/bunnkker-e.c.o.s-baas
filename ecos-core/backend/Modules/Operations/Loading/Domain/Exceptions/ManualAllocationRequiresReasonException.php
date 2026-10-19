<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Exceptions;

use RuntimeException;

final class ManualAllocationRequiresReasonException extends RuntimeException
{
    public static function make(): self
    {
        return new self('Manual allocation override requires a non-empty reason.');
    }
}
