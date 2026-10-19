<?php

declare(strict_types=1);

namespace Modules\IAM\Infrastructure\Middleware;

use Closure;
use Illuminate\Http\Request;
use Modules\IAM\Domain\Contracts\AuthorizationGatewayInterface;
use Symfony\Component\HttpFoundation\Response;

/**
 * Middleware alias: permission
 *
 * Usage in routes:
 *   ->middleware('permission:inventory.products.view')
 *   ->middleware('permission:sales.orders.fulfill')
 *
 * Returns 401 for unauthenticated requests, 403 for authenticated requests
 * that lack the required permission.
 *
 * System role bypass: any role with is_system = true passes unconditionally,
 * regardless of slug. Never hardcode role names here.
 *
 * Runtime path (TASK-IAM-006A / ADR-038)
 * --------------------------------------
 * Authorization is asked of AuthorizationGateway, which is the single entry
 * point. The gateway composes the decision:
 *
 *   inspect()            system role → allow, else PermissionService lookup
 *   PolicyResolver       may veto an otherwise-allowed action
 *   VisibilityResolver   enriches the decision with hidden fields
 *   ScopeResolver        enriches the decision with the data scope
 *
 * This middleware previously called PermissionServiceInterface directly, which
 * left the policy, visibility and scope engines outside the runtime path. The
 * evaluation itself is unchanged: the gateway's own allow/deny comes from the
 * same two PermissionService calls this class used to make.
 *
 * decision() is used rather than can(), because can() performs a bare
 * permission lookup WITHOUT the system-role bypass — using it here would
 * silently deny system roles that hold no explicit grant.
 */
final class RequirePermissionMiddleware
{
    public function __construct(
        private readonly AuthorizationGatewayInterface $gateway,
    ) {}

    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $user = $request->user();

        if ($user === null) {
            abort(401, 'Unauthenticated.');
        }

        if ($this->gateway->decision($user, $permission)->isDenied()) {
            abort(403, "Permission denied: {$permission}");
        }

        return $next($request);
    }
}
