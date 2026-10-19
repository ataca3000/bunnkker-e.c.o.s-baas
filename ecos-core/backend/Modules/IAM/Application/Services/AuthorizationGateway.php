<?php

declare(strict_types=1);

namespace Modules\IAM\Application\Services;

use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Modules\IAM\Domain\Contracts\AuthorizationGatewayInterface;
use Modules\IAM\Domain\Contracts\PermissionServiceInterface;
use Modules\IAM\Domain\Contracts\PolicyResolverInterface;
use Modules\IAM\Domain\Contracts\ScopeResolverInterface;
use Modules\IAM\Domain\Contracts\VisibilityResolverInterface;
use Modules\IAM\Domain\ValueObjects\AuthorizationDecision;
use Modules\IAM\Domain\ValueObjects\PermissionName;

/**
 * AuthorizationGateway — the single orchestration point of the Enterprise
 * Authorization Platform (TASK-IAM-002 / ADR-038).
 *
 * can()/cannot()/authorize()/inspect() are pure Authorization (byte-for-byte
 * delegation to the existing PermissionService — no behaviour change, zero extra
 * queries). decision() additionally composes the Visibility, Data Scope, and Policy
 * engines into one immutable, auditable AuthorizationDecision with deny-overrides.
 */
final class AuthorizationGateway implements AuthorizationGatewayInterface
{
    public function __construct(
        private readonly PermissionServiceInterface $permissions,
        private readonly VisibilityResolverInterface $visibility,
        private readonly ScopeResolverInterface $scope,
        private readonly PolicyResolverInterface $policy,
    ) {
    }

    public function can(User $user, string|PermissionName $permission, mixed $subject = null): bool
    {
        return $this->permissions->userHasPermission($user, $this->name($permission));
    }

    public function cannot(User $user, string|PermissionName $permission, mixed $subject = null): bool
    {
        return ! $this->can($user, $permission, $subject);
    }

    public function authorize(User $user, string|PermissionName $permission, mixed $subject = null): void
    {
        if (! $this->can($user, $permission, $subject)) {
            throw new AuthorizationException(
                sprintf('This action is unauthorized (%s).', $this->name($permission)),
            );
        }
    }

    public function inspect(User $user, string|PermissionName $permission, mixed $subject = null): AuthorizationDecision
    {
        $name = $this->name($permission);

        if ($this->permissions->userHasSystemRole($user)) {
            return AuthorizationDecision::allow($name, $name, null, 'system role bypass', 'system');
        }

        return $this->permissions->userHasPermission($user, $name)
            ? AuthorizationDecision::allow($name, $name, null, 'permission granted via assigned role')
            : AuthorizationDecision::deny($name, 'no assigned role grants this permission');
    }

    public function decision(User $user, string|PermissionName $permission, mixed $subject = null): AuthorizationDecision
    {
        $name = $this->name($permission);
        $decision = $this->inspect($user, $permission, $subject);

        // Denied by authorization → nothing further to compose.
        if ($decision->isDenied()) {
            return $decision;
        }

        // ── Policy Engine: business rules may veto an otherwise-allowed action ──
        if ($this->policy->hasRulesFor($name)) {
            $policyResult = $this->policy->evaluate($user, $name, $subject);
            $decision = $decision->withPolicy($policyResult->rule);

            if ($policyResult->isDenied()) {
                return $decision->deniedBecause($policyResult->reason, 'policy');
            }
        }

        // ── Visibility + Data Scope enrich the (still-allowed) decision ──
        $resource = $this->resourceOf($permission, $name);

        if ($resource !== null) {
            $decision = $decision->withHiddenFields($this->visibility->hiddenFields($user, $resource));
            $decision = $decision->withScope($this->scope->resolve($user, $resource)->scope->value);
        }

        return $decision;
    }

    public function decide(User $user, string|PermissionName $permission, mixed $subject = null): AuthorizationDecision
    {
        return $this->decision($user, $permission, $subject);
    }

    private function name(string|PermissionName $permission): string
    {
        return $permission instanceof PermissionName ? $permission->value() : $permission;
    }

    /**
     * The "{module}.{resource}" the Visibility and Data Scope engines key off, or the
     * module for a two-segment name. Null when the name is outside the grammar.
     */
    private function resourceOf(string|PermissionName $permission, string $name): ?string
    {
        $parsed = $permission instanceof PermissionName ? $permission : PermissionName::tryFrom($name);

        if ($parsed === null) {
            return null;
        }

        return $parsed->resource() === null
            ? $parsed->module()
            : $parsed->module().'.'.$parsed->resource();
    }
}
