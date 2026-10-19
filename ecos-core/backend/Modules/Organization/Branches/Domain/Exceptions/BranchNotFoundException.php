<?php

declare(strict_types=1);

namespace Modules\Organization\Branches\Domain\Exceptions;

use App\Core\Exceptions\BusinessException;

/**
 * Thrown when a branch cannot be found. Maps to HTTP 404.
 */
final class BranchNotFoundException extends BusinessException
{
    public function __construct()
    {
        parent::__construct('Branch not found.', [], 404);
    }
}
