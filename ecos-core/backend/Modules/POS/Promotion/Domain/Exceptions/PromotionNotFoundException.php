<?php

declare(strict_types=1);

namespace Modules\POS\Promotion\Domain\Exceptions;

use DomainException;

final class PromotionNotFoundException extends DomainException
{
    public static function withId(string $id): self
    {
        return new self("Promotion [{$id}] not found.");
    }
}
