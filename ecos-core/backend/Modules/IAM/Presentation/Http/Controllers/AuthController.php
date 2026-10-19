<?php

declare(strict_types=1);

namespace Modules\IAM\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\IAM\Application\Actions\LoginAction;
use Modules\IAM\Application\Actions\LogoutAction;
use Modules\IAM\Application\DTO\AuthenticatedUserDTO;
use Modules\IAM\Application\DTO\LoginDTO;
use Modules\IAM\Presentation\Http\Requests\LoginRequest;

/**
 * Authentication endpoints. Controllers stay thin: validation lives in form
 * requests, behavior in actions, and responses use the Core ApiResponse.
 */
final class AuthController extends Controller
{
    use HasApiResponse;

    public function login(LoginRequest $request, LoginAction $action): JsonResponse
    {
        /** @var array{email: string, password: string, remember?: bool} $data */
        $data = $request->validated();

        $result = $action->execute(LoginDTO::fromArray($data));

        return $this->success($result->data(), $result->message());
    }

    public function logout(Request $request, LogoutAction $action): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $action->execute($user);

        return $this->success(null, 'Logged out successfully.');
    }

    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return $this->success(AuthenticatedUserDTO::fromModel($user)->toArray());
    }
}
