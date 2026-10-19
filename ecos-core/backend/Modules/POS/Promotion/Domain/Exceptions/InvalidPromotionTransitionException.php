<?php

declare(strict_types=1);

namespace Modules\POS\Promotion\Domain\Exceptions;

use DomainException;
use Modules\POS\Promotion\Domain\Enums\PromotionStatus;

final class InvalidPromotionTransitionException extends DomainException
{
    public static function cannotActivate(string $id, PromotionStatus $current): self
    {
        return new self(
            "Promotion [{$id}] cannot be activated — current status is {$current->value}.",
        );
    }

    public static function cannotPause(string $id, PromotionStatus $current): self
    {
        return new self(
            "Promotion [{$id}] cannot be paused — current status is {$current->value}.",
        );
    }

    public static function cannotExpire(string $id, PromotionStatus $current): self
    {
        return new self(
            "Promotion [{$id}] cannot be expired — current status is {$current->value}.",
        );
    }

    public static function cannotCancel(string $id, PromotionStatus $current): self
    {
        return new self(
            "Promotion [{$id}] cannot be cancelled — current status is {$current->value}.",
        );
    }

    public static function promotionNotActive(string $id): self
    {
        return new self(
            "Cannot record use for promotion [{$id}] — it is not active.",
        );
    }
}
