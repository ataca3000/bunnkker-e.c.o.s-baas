<?php

declare(strict_types=1);

namespace Modules\IAM\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use InvalidArgumentException;
use Modules\IAM\Application\DTO\AuthenticatedUserDTO;
use Modules\IAM\Application\DTO\LoginDTO;
use Modules\IAM\Domain\Contracts\AuthServiceInterface;
use Modules\IAM\Domain\Exceptions\InvalidCredentialsException;

/**
 * Authenticates a user and issues an API token.
 */
final class LoginAction extends BaseAction
{
    public function __construct(private readonly AuthServiceInterface $authService) {}

    /**
     * @param  mixed  ...$arguments  Expects a single {@see LoginDTO}.
     *
     * @throws InvalidCredentialsException When the credentials do not match.
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        $dto = $arguments[0] ?? null;

        if (! $dto instanceof LoginDTO) {
            throw new InvalidArgumentException('LoginAction::execute expects a LoginDTO.');
        }

        $user = $this->authService->attemptCredentials($dto->email, $dto->password);

        if ($user === null) {
            throw new InvalidCredentialsException;
        }

        $token = $this->authService->issueToken($user, $dto->remember);

        return OperationResult::success(
            [
                'token' => $token,
                'token_type' => 'Bearer',
                'user' => AuthenticatedUserDTO::fromModel($user)->toArray(),
            ],
            'Authenticated successfully.',
        );
    }
}
