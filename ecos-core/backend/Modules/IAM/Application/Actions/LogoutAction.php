<?php

declare(strict_types=1);

namespace Modules\IAM\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use App\Models\User;
use InvalidArgumentException;
use Modules\IAM\Domain\Contracts\AuthServiceInterface;

/**
 * Revokes the access token used for the current request.
 */
final class LogoutAction extends BaseAction
{
    public function __construct(private readonly AuthServiceInterface $authService) {}

    /**
     * @param  mixed  ...$arguments  Expects the authenticated {@see User}.
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        $user = $arguments[0] ?? null;

        if (! $user instanceof User) {
            throw new InvalidArgumentException('LogoutAction::execute expects a User.');
        }

        $this->authService->revokeCurrentToken($user);

        return OperationResult::success(null, 'Logged out successfully.');
    }
}
