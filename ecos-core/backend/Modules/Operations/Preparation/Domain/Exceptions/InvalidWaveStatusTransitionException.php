<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Exceptions;

use Modules\Operations\Preparation\Domain\Enums\WaveStatus;
use RuntimeException;

final class InvalidWaveStatusTransitionException extends RuntimeException
{
    public static function from(WaveStatus $from, WaveStatus $to): self
    {
        return new self(
            "Cannot transition preparation wave from [{$from->value}] to [{$to->value}].",
        );
    }
}
