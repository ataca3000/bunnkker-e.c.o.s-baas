<?php

declare(strict_types=1);

namespace Modules\POS\Application\Exceptions;

use App\Core\Exceptions\BusinessException;

final class ShiftNotFoundException extends BusinessException
{
    public static function withId(string $id): self
    {
        return new self("Shift '{$id}' not found.", [], 404);
    }
}
