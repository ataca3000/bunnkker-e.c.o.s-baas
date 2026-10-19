<?php

declare(strict_types=1);

namespace App\Core\Responses;

use Illuminate\Http\JsonResponse;

/**
 * Factory for standardized JSON API responses.
 *
 * Every response shares a consistent envelope so that all current and future
 * modules return predictable payloads to API clients:
 *
 *  {
 *      "success": bool,
 *      "message": string|null,
 *      "data":    mixed,
 *      "errors":  array
 *  }
 *
 * This is the only intentionally framework-coupled Core class (it returns an
 * {@see JsonResponse}); it still contains no business logic.
 */
final class ApiResponse
{
    /**
     * A successful response (HTTP 200 by default).
     *
     * @param  mixed  $data  Payload returned to the client.
     * @param  string  $message  Human-readable message.
     * @param  int  $status  HTTP status code.
     */
    public static function success(mixed $data = null, string $message = 'OK', int $status = 200): JsonResponse
    {
        return self::make(true, $message, $data, [], $status);
    }

    /**
     * A generic error response (HTTP 400 by default).
     *
     * @param  string  $message  Human-readable error message.
     * @param  int  $status  HTTP status code.
     * @param  array<int|string, mixed>  $errors  Optional error details.
     */
    public static function error(string $message = 'Error', int $status = 400, array $errors = []): JsonResponse
    {
        return self::make(false, $message, null, $errors, $status);
    }

    /**
     * A validation-error response (HTTP 422 by default).
     *
     * @param  array<int|string, mixed>  $errors  Field-keyed validation errors.
     * @param  string  $message  Human-readable message.
     * @param  int  $status  HTTP status code.
     */
    public static function validation(array $errors, string $message = 'The given data was invalid.', int $status = 422): JsonResponse
    {
        return self::make(false, $message, null, $errors, $status);
    }

    /**
     * A resource-created response (HTTP 201).
     *
     * @param  mixed  $data  The created resource.
     * @param  string  $message  Human-readable message.
     */
    public static function created(mixed $data = null, string $message = 'Resource created successfully.'): JsonResponse
    {
        return self::make(true, $message, $data, [], 201);
    }

    /**
     * A resource-updated response (HTTP 200).
     *
     * @param  mixed  $data  The updated resource.
     * @param  string  $message  Human-readable message.
     */
    public static function updated(mixed $data = null, string $message = 'Resource updated successfully.'): JsonResponse
    {
        return self::make(true, $message, $data, [], 200);
    }

    /**
     * A resource-deleted response (HTTP 200).
     *
     * @param  string  $message  Human-readable message.
     */
    public static function deleted(string $message = 'Resource deleted successfully.'): JsonResponse
    {
        return self::make(true, $message, null, [], 200);
    }

    /**
     * Build a response from an {@see OperationResult}.
     *
     * @param  OperationResult  $result  The operation outcome to translate.
     * @param  int  $successStatus  HTTP status used when the result succeeded.
     * @param  int  $failureStatus  HTTP status used when the result failed.
     */
    public static function fromResult(OperationResult $result, int $successStatus = 200, int $failureStatus = 422): JsonResponse
    {
        return self::make(
            $result->isSuccess(),
            $result->message(),
            $result->data(),
            $result->errors(),
            $result->isSuccess() ? $successStatus : $failureStatus,
        );
    }

    /**
     * Assemble the standardized envelope as a JsonResponse.
     *
     * @param  bool  $success  Success flag.
     * @param  string|null  $message  Message.
     * @param  mixed  $data  Payload.
     * @param  array<int|string, mixed>  $errors  Error details.
     * @param  int  $status  HTTP status code.
     */
    private static function make(bool $success, ?string $message, mixed $data, array $errors, int $status): JsonResponse
    {
        return new JsonResponse([
            'success' => $success,
            'message' => $message,
            'data' => $data,
            'errors' => $errors,
        ], $status);
    }
}
