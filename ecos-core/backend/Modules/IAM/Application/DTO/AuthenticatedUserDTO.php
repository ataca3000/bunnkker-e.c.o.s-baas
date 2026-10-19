<?php

declare(strict_types=1);

namespace Modules\IAM\Application\DTO;

use App\Core\DTO\BaseDTO;
use App\Models\User;
use Modules\IAM\Application\Services\AuthorizationContextBuilder;
use Modules\IAM\Domain\Contracts\PermissionServiceInterface;

/**
 * Immutable, safe representation of the authenticated user returned to clients.
 * Excludes sensitive attributes (password, tokens, …).
 *
 * TASK-IAM-002: additionally carries the user's effective `permissions` and the
 * `is_system` flag so the frontend Authorization infrastructure (can/canViewField/
 * hasScope) has the data it needs. Additive — existing consumers are unaffected.
 */
final class AuthenticatedUserDTO extends BaseDTO
{
    /**
     * @param  list<string>  $permissions
     * @param  array<string,mixed>  $authorization  full UI authorization context (TASK-IAM-005)
     */
    public function __construct(
        public readonly int $id,
        public readonly string $name,
        public readonly string $email,
        public readonly ?string $company_id,
        public readonly array $permissions = [],
        public readonly bool $is_system = false,
        public readonly array $authorization = [],
    ) {}

    public static function fromModel(User $user): self
    {
        $companyId = $user->company_id ?? null;

        /** @var PermissionServiceInterface $permissions */
        $permissions = app(PermissionServiceInterface::class);
        /** @var AuthorizationContextBuilder $context */
        $context = app(AuthorizationContextBuilder::class);

        return new self(
            id: (int) $user->id,
            name: (string) $user->name,
            email: (string) $user->email,
            company_id: is_string($companyId) && $companyId !== '' ? $companyId : null,
            permissions: $permissions->getUserPermissions($user),
            is_system: $permissions->userHasSystemRole($user),
            authorization: $context->build($user),
        );
    }
}
