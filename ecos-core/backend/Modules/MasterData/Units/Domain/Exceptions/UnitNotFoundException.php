<?php

declare(strict_types=1);

namespace Modules\MasterData\Units\Domain\Exceptions;

use App\Core\Exceptions\BusinessException;

/**
 * Thrown when a unit of measure cannot be found. Maps to HTTP 404.
 */
final class UnitNotFoundException extends BusinessException
{
    public function __construct()
    {
        parent::__construct('Unit not found.', [], 404);
    }
}
