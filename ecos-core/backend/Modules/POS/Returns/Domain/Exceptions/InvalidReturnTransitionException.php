<?php

declare(strict_types=1);

namespace Modules\POS\Returns\Domain\Exceptions;

use DomainException;
use Modules\POS\Shared\Domain\Enums\ReturnStatus;

final class InvalidReturnTransitionException extends DomainException
{
    public static function cannotProcess(string $returnId, ReturnStatus $current): self
    {
        return new self(
            "Cannot process return '{$returnId}': return is in '{$current->value}' state.",
        );
    }

    public static function cannotCancel(string $returnId, ReturnStatus $current): self
    {
        return new self(
            "Cannot cancel return '{$returnId}': return is in '{$current->value}' state.",
        );
    }
}
