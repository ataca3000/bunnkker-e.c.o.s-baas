<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Contracts;

use App\Models\User;
use Modules\IAM\Domain\ValueObjects\AuthorizationDecision;
use Modules\IAM\Domain\ValueObjects\PermissionName;

/**
 * AuthorizationGatewayInterface — the single public entry point for authorization,
 * visibility, and data scope (TASK-IAM-002 / ADR-038, Part 1).
 *
 * From this contract onward, business modules ask the Gateway — never the
 * PermissionService, VisibilityResolver, ScopeResolver, PolicyResolver, or any future
 * engine directly. The Gateway owns orchestration; the engines stay private.
 */
interface AuthorizationGatewayInterface
{
    /**
     * Can the user execute the given action/permission? (Authorization only —
     * byte-for-byte delegation to the existing PermissionService.)
     */
    public function can(User $user, string|PermissionName $permission, mixed $subject = null): bool;

    /**
     * Inverse of can().
     */
    public function cannot(User $user, string|PermissionName $permission, mixed $subject = null): bool;

    /**
     * Throw when the user is not allowed (Laravel-style guard for controllers).
     *
     * @throws \Illuminate\Auth\Access\AuthorizationException
     */
    public function authorize(User $user, string|PermissionName $permission, mixed $subject = null): void;

    /**
     * Quick, authorization-only explanation (no visibility/scope/policy composition).
     */
    public function inspect(User $user, string|PermissionName $permission, mixed $subject = null): AuthorizationDecision;

    /**
     * The full composed platform decision: Authorization + Visibility (hidden fields)
     * + Data Scope (matched scope) + Policy (business rules). Deny-overrides.
     */
    public function decision(User $user, string|PermissionName $permission, mixed $subject = null): AuthorizationDecision;

    /**
     * @deprecated Phase-1 alias of decision(). Retained for backward compatibility.
     */
    public function decide(User $user, string|PermissionName $permission, mixed $subject = null): AuthorizationDecision;
}
