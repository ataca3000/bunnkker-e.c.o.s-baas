<?php

declare(strict_types=1);

namespace Modules\Organization\Companies\Domain\Exceptions;

use App\Core\Exceptions\BusinessException;

/**
 * Thrown when a company cannot be found. Maps to HTTP 404.
 */
final class CompanyNotFoundException extends BusinessException
{
    public function __construct()
    {
        parent::__construct('Company not found.', [], 404);
    }
}
