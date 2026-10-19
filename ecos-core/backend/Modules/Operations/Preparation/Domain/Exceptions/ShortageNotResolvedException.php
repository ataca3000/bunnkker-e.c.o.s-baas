<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Exceptions;

use RuntimeException;

final class ShortageNotResolvedException extends RuntimeException
{
    public function __construct(string $waveId)
    {
        parent::__construct(
            "Wave [{$waveId}] has unresolved shortages. A supervisor must override to proceed.",
        );
    }
}
