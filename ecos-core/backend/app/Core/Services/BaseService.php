<?php

declare(strict_types=1);

namespace App\Core\Services;

use App\Contracts\ServiceInterface;
use App\Core\Responses\OperationResult;

/**
 * Base class for application/domain services.
 *
 * Provides shared, reusable helpers for producing consistent
 * {@see OperationResult} outcomes. It deliberately contains **no business
 * logic** — concrete services in modules implement the actual behavior and use
 * these helpers to standardize their return values.
 */
abstract class BaseService implements ServiceInterface
{
    /**
     * Build a successful operation result.
     *
     * @param  mixed  $data  Optional payload.
     * @param  string|null  $message  Optional message.
     */
    protected function success(mixed $data = null, ?string $message = null): OperationResult
    {
        return OperationResult::success($data, $message);
    }

    /**
     * Build a failed operation result.
     *
     * @param  string|null  $message  Optional message.
     * @param  array<int|string, mixed>  $errors  Optional error details.
     */
    protected function failure(?string $message = null, array $errors = []): OperationResult
    {
        return OperationResult::failure($message, $errors);
    }
}
