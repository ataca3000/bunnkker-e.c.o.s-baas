<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Exceptions;

use Modules\Operations\Loading\Domain\Enums\LoadingSessionStatus;
use RuntimeException;

final class InvalidLoadingSessionStatusTransitionException extends RuntimeException
{
    public function __construct(
        public readonly LoadingSessionStatus $fromStatus,
        public readonly LoadingSessionStatus $toStatus,
    ) {
        parent::__construct(
            "Invalid loading session status transition from [{$fromStatus->value}] to [{$toStatus->value}].",
        );
    }

    public static function from(LoadingSessionStatus $from, LoadingSessionStatus $to): static
    {
        return new self($from, $to);
    }
}
