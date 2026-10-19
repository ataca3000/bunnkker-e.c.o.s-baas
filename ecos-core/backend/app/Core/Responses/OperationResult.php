<?php

declare(strict_types=1);

namespace App\Core\Responses;

use JsonSerializable;

/**
 * Immutable value object describing the outcome of an operation.
 *
 * Services and actions return an OperationResult instead of throwing for
 * expected, recoverable outcomes. It carries a success flag, an optional
 * message, an optional data payload, and a collection of errors.
 *
 * Framework-agnostic and free of business logic; map it to an HTTP response
 * with {@see ApiResponse::fromResult()} when needed.
 */
final class OperationResult implements JsonSerializable
{
    /**
     * @param  bool  $success  Whether the operation succeeded.
     * @param  string|null  $message  Human-readable outcome message.
     * @param  mixed  $data  Optional payload produced by the operation.
     * @param  array<int|string, mixed>  $errors  Collection of error details.
     */
    private function __construct(
        private readonly bool $success,
        private readonly ?string $message = null,
        private readonly mixed $data = null,
        private readonly array $errors = [],
    ) {}

    /**
     * Create a successful result.
     *
     * @param  mixed  $data  Optional payload.
     * @param  string|null  $message  Optional message.
     */
    public static function success(mixed $data = null, ?string $message = null): self
    {
        return new self(true, $message, $data, []);
    }

    /**
     * Create a failed result.
     *
     * @param  string|null  $message  Optional message.
     * @param  array<int|string, mixed>  $errors  Optional error details.
     * @param  mixed  $data  Optional payload.
     */
    public static function failure(?string $message = null, array $errors = [], mixed $data = null): self
    {
        return new self(false, $message, $data, $errors);
    }

    /**
     * Whether the operation succeeded.
     */
    public function isSuccess(): bool
    {
        return $this->success;
    }

    /**
     * Whether the operation failed.
     */
    public function isFailure(): bool
    {
        return ! $this->success;
    }

    /**
     * The outcome message, if any.
     */
    public function message(): ?string
    {
        return $this->message;
    }

    /**
     * The result payload, if any.
     */
    public function data(): mixed
    {
        return $this->data;
    }

    /**
     * The collection of error details.
     *
     * @return array<int|string, mixed>
     */
    public function errors(): array
    {
        return $this->errors;
    }

    /**
     * Convert the result to an associative array.
     *
     * @return array{success: bool, message: string|null, data: mixed, errors: array<int|string, mixed>}
     */
    public function toArray(): array
    {
        return [
            'success' => $this->success,
            'message' => $this->message,
            'data' => $this->data,
            'errors' => $this->errors,
        ];
    }

    /**
     * Data used when the result is passed to json_encode().
     *
     * @return array{success: bool, message: string|null, data: mixed, errors: array<int|string, mixed>}
     */
    public function jsonSerialize(): array
    {
        return $this->toArray();
    }
}
