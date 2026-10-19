<?php

declare(strict_types=1);

namespace App\Traits;

use App\Core\Responses\ApiResponse;
use App\Core\Responses\OperationResult;
use Illuminate\Http\JsonResponse;

/**
 * Convenience trait exposing the standardized API responses to consumers
 * (typically HTTP controllers).
 *
 * It simply delegates to {@see ApiResponse}, so there is a single source of
 * truth for the response envelope and no duplicated formatting logic.
 */
trait HasApiResponse
{
    /**
     * Standardized success response.
     *
     * @param  mixed  $data  Payload.
     * @param  string  $message  Message.
     * @param  int  $status  HTTP status code.
     */
    protected function success(mixed $data = null, string $message = 'OK', int $status = 200): JsonResponse
    {
        return ApiResponse::success($data, $message, $status);
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
     * @param  string  $message  Message.
     * @param  int  $status  HTTP status code.
     */
    protected function validation(array $errors, string $message = 'The given data was invalid.', int $status = 422): JsonResponse
    {
        return ApiResponse::validation($errors, $message, $status);
    }

    /**
     * Standardized resource-created response.
     *
     * @param  mixed  $data  The created resource.
     * @param  string  $message  Message.
     */
    protected function created(mixed $data = null, string $message = 'Resource created successfully.'): JsonResponse
    {
        return ApiResponse::created($data, $message);
    }

    /**
     * Standardized resource-updated response.
     *
     * @param  mixed  $data  The updated resource.
     * @param  string  $message  Message.
     */
    protected function updated(mixed $data = null, string $message = 'Resource updated successfully.'): JsonResponse
    {
        return ApiResponse::updated($data, $message);
    }

    /**
     * Standardized resource-deleted response.
     *
     * @param  string  $message  Message.
     */
    protected function deleted(string $message = 'Resource deleted successfully.'): JsonResponse
    {
        return ApiResponse::deleted($message);
    }

    /**
     * Standardized response built from an {@see OperationResult}.
     *
     * @param  OperationResult  $result  The operation outcome to translate.
     */
    protected function respondFromResult(OperationResult $result): JsonResponse
    {
        return ApiResponse::fromResult($result);
    }
}
