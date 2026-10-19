<?php

declare(strict_types=1);

namespace App\Core\Exceptions;

use RuntimeException;
use Throwable;

/**
 * Base exception for violated business/domain rules.
 *
 * Thrown when an operation cannot proceed because a business invariant is not
 * satisfied. Carries an optional collection of errors and an associated HTTP
 * status code so framework exception handlers can render it consistently — the
 * exception itself stays free of framework dependencies and business logic.
 */
class BusinessException extends RuntimeException
{
    /**
     * @param  string  $message  Human-readable explanation of the violation.
     * @param  array<int|string, mixed>  $errors  Optional structured error details.
     * @param  int  $statusCode  Suggested HTTP status code for handlers.
     * @param  int  $code  Internal exception code.
     * @param  Throwable|null  $previous  Previous exception for chaining.
     */
    public function __construct(
        string $message = 'A business rule has been violated.',
        private readonly array $errors = [],
        private readonly int $statusCode = 400,
        int $code = 0,
        ?Throwable $previous = null,
    ) {
        parent::__construct($message, $code, $previous);
    }

    /**
     * Structured error details associated with the violation.
     *
     * @return array<int|string, mixed>
     */
    public function getErrors(): array
    {
        return $this->errors;
    }

    /**
     * Suggested HTTP status code for rendering this exception.
     */
    public function getStatusCode(): int
    {
        return $this->statusCode;
    }
}
