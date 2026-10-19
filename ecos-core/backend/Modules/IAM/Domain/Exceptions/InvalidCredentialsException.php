<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Exceptions;

use App\Core\Exceptions\BusinessException;

/**
 * Thrown when login credentials do not match any account.
 *
 * Carries a generic, non-sensitive message and HTTP 401 so handlers never leak
 * whether the email or the password was the failing factor.
 */
final class InvalidCredentialsException extends BusinessException
{
    public function __construct()
    {
        parent::__construct('The provided credentials are incorrect.', [], 401);
    }
}
