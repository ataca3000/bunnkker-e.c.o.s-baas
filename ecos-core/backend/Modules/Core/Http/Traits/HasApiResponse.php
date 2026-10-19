<?php

declare(strict_types=1);

namespace Modules\Core\Http\Traits;

use App\Core\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * Module-facing alias of the standardized API response trait.
 *
 * Engineering-module controllers import this namespace; it delegates to
 * {@see ApiResponse} exactly like {@see \App\Traits\HasApiResponse}, with
 * one ergonomic addition: success() accepts either the (data, message,
 * status) convention of the core trait or the (data, status) shorthand
 * used across the Engineering module.
 */
trait HasApiResponse
{
    /**
     * Standardized success response.
     *
     * @param  mixed  $data  Payload.
     * @param  int|string  $messageOrStatus  Message, or an HTTP status code shorthand.
     * @param  int  $status  HTTP status code (when a message is given).
     */
    protected function success(mixed $data = null, int|string $messageOrStatus = 'OK', int $status = 200): JsonResponse
    {
        if (is_int($messageOrStatus)) {
            return ApiResponse::success($data, 'OK', $messageOrStatus);
        }

        return ApiResponse::success($data, $messageOrStatus, $status);
    }

    /**
     * Standardized error response.
     *
     * @param  string  $message  Error message.
     * @param  int  $status  HTTP status code.
     * @param  array<int|string, mixed>  $errors  Optional error details.
     */
    protected function error(string $message = 'Error', int $status = 400, array $errors = []): JsonResponse
    {
        return ApiResponse::error($message, $status, $errors);
    }

    /**
     * Standardized validation-error response.
     *
     * @param  array<int|string, mixed>  $errors  Field-keyed validation errors.
     */
    protected function validation(array $errors, string $message = 'The given data was invalid.', int $status = 422): JsonResponse
    {
        return ApiResponse::validation($errors, $message, $status);
    }
}
