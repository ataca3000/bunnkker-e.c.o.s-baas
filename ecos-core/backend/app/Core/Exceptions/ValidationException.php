<?php

declare(strict_types=1);

namespace App\Core\Exceptions;

use Throwable;

/**
 * Application-level validation exception.
 *
 * A specialization of {@see BusinessException} for input that fails validation.
 * It defaults to HTTP 422 (Unprocessable Entity) and carries field-keyed error
 * messages, independent of any framework validator.
 */
class ValidationException extends BusinessException
{
    /**
     * @param  array<string, array<int, string>>  $errors  Field-keyed validation messages.
     * @param  string  $message  Human-readable summary message.
     * @param  int  $code  Internal exception code.
     * @param  Throwable|null  $previous  Previous exception for chaining.
     */
    public function __construct(
        array $errors = [],
        string $message = 'The given data was invalid.',
        int $code = 0,
        ?Throwable $previous = null,
    ) {
        parent::__construct($message, $errors, 422, $code, $previous);
    }
}
