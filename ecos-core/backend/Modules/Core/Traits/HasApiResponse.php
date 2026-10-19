<?php

declare(strict_types=1);

namespace Modules\Core\Traits;

use App\Core\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * Namespace alias of {@see \Modules\Core\Http\Traits\HasApiResponse}.
 * Some Engineering-module controllers import this variant; keep the two
 * in sync (both delegate to {@see ApiResponse}).
 */
trait HasApiResponse
{
    /**
     * Standardized success response. Accepts either (data, message, status)
     * or the (data, status) shorthand used across the Engineering module.
     *
     * @param  mixed  $data
     * @param  int|string  $messageOrStatus
     */
    protected function success(mixed $data = null, int|string $messageOrStatus = 'OK', int $status = 200): JsonResponse
    {
        if (is_int($messageOrStatus)) {
            return ApiResponse::success($data, 'OK', $messageOrStatus);
        }

        return ApiResponse::success($data, $messageOrStatus, $status);
    }

    /**
     * @param  array<int|string, mixed>  $errors
     */
    protected function error(string $message = 'Error', int $status = 400, array $errors = []): JsonResponse
    {
        return ApiResponse::error($message, $status, $errors);
    }

    /**
     * @param  array<int|string, mixed>  $errors
     */
    protected function validation(array $errors, string $message = 'The given data was invalid.', int $status = 422): JsonResponse
    {
        return ApiResponse::validation($errors, $message, $status);
    }
}
