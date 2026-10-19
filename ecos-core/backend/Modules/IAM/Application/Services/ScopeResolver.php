<?php

declare(strict_types=1);

namespace Modules\IAM\Application\Services;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Modules\IAM\Domain\Contracts\PermissionServiceInterface;
use Modules\IAM\Domain\Contracts\ScopeResolverInterface;
use Modules\IAM\Domain\Enums\DataScope;
use Modules\IAM\Domain\ValueObjects\ScopeConstraint;

/**
 * ScopeResolver — the Enterprise Data Scope Engine (TASK-IAM-002 / ADR-038, Part 3).
 *
 * Resolves the WIDEST data scope the user holds for a resource (from the grant's
 * role_permissions.data_scope) and returns a declarative ScopeConstraint.
 *
 * Backward compatible by construction: the column defaults to 'all', and a resource
 * with no explicit narrow grant resolves to ALL → unrestricted → identical to today.
 * Narrow scopes deny-by-default when they cannot be resolved (secure), but this only
 * affects queries a module has explicitly opted into via `scopedTo()`.
 */
final class ScopeResolver implements ScopeResolverInterface
{
    private const CACHE_TTL = 300;

    /** Rank so the WIDEST scope a user holds wins. */
    private const RANK = [
        'all' => 100, 'company' => 90, 'region' => 80, 'business_unit' => 70,
        'department' => 60, 'channel' => 50, 'branch' => 40, 'warehouse' => 30,
        'team' => 20, 'custom' => 15, 'self' => 10,
    ];

    public function __construct(
        private readonly PermissionServiceInterface $permissions,
    ) {
    }

    public function resolve(User $user, string $resource, ?string $ownerColumn = null): ScopeConstraint
    {
        // System roles are never data-restricted.
        if ($this->permissions->userHasSystemRole($user)) {
            return ScopeConstraint::unrestricted();
        }

        [$scope, $descriptor] = $this->widestScopeFor($user, $resource);

        return $this->constraintFor($user, $scope, $descriptor, $ownerColumn ?? 'created_by');
    }

    /**
     * @return array{0: DataScope, 1: array<string, mixed>}
     */
    private function widestScopeFor(User $user, string $resource): array
    {
        $key = "rbac.scope.{$user->getKey()}.{$resource}";

        /** @var array{scope: string, descriptor: ?string} $row */
        $row = Cache::remember($key, self::CACHE_TTL, function () use ($user, $resource): array {
            $grants = DB::table('user_roles as ur')
                ->join('role_permissions as rp', 'rp.role_id', '=', 'ur.role_id')
                ->join('permissions as p', 'p.id', '=', 'rp.permission_id')
                ->where('ur.user_id', $user->getKey())
                ->where('p.name', 'like', $resource.'.%')
                ->get(['rp.data_scope', 'rp.scope_descriptor']);

            // No explicit grant for this resource → ALL (backward compatible default).
            if ($grants->isEmpty()) {
                return ['scope' => DataScope::ALL->value, 'descriptor' => null];
            }

            $best = null;
            $bestDescriptor = null;

            foreach ($grants as $grant) {
                $value = (string) ($grant->data_scope ?? DataScope::ALL->value);
                $rank = self::RANK[$value] ?? 0;

                if ($best === null || $rank > (self::RANK[$best] ?? 0)) {
                    $best = $value;
                    $bestDescriptor = $grant->scope_descriptor ?? null;
                }
            }

            return ['scope' => $best ?? DataScope::ALL->value, 'descriptor' => $bestDescriptor];
        });

        $scope = DataScope::tryFrom($row['scope']) ?? DataScope::ALL;
        $descriptor = is_string($row['descriptor'] ?? null)
            ? (array) json_decode((string) $row['descriptor'], true)
            : [];

        return [$scope, $descriptor];
    }

    /**
     * @param  array<string, mixed>  $descriptor
     */
    private function constraintFor(User $user, DataScope $scope, array $descriptor, string $ownerColumn): ScopeConstraint
    {
        return match ($scope) {
            DataScope::ALL => ScopeConstraint::unrestricted(),

            DataScope::SELF => ScopeConstraint::where($scope, $ownerColumn, [$user->getKey()]),

            DataScope::COMPANY => $user->company_id === null
                ? ScopeConstraint::unrestricted($scope)                       // super-admin-style
                : ScopeConstraint::where($scope, 'company_id', [$user->company_id], orNull: true),

            DataScope::BRANCH => ScopeConstraint::where($scope, 'branch_id', $this->userScopeIds($user, 'branch_id')),

            DataScope::WAREHOUSE => ScopeConstraint::where($scope, 'warehouse_id', $this->userScopeIds($user, 'warehouse_id')),

            // Descriptor-driven scopes: {"column": "...", "values": [...]}.
            // Without a descriptor they deny by default (secure).
            DataScope::TEAM,
            DataScope::CHANNEL,
            DataScope::REGION,
            DataScope::BUSINESS_UNIT,
            DataScope::DEPARTMENT,
            DataScope::CUSTOM => $this->descriptorConstraint($scope, $descriptor),
        };
    }

    /**
     * @return list<string>
     */
    private function userScopeIds(User $user, string $column): array
    {
        /** @var list<string> $ids */
        $ids = DB::table('user_roles')
            ->where('user_id', $user->getKey())
            ->whereNotNull($column)
            ->pluck($column)
            ->unique()
            ->values()
            ->all();

        return $ids;
    }

    /**
     * @param  array<string, mixed>  $descriptor
     */
    private function descriptorConstraint(DataScope $scope, array $descriptor): ScopeConstraint
    {
        $column = $descriptor['column'] ?? null;
        $values = $descriptor['values'] ?? null;

        if (! is_string($column) || ! is_array($values)) {
            return ScopeConstraint::none($scope); // deny by default
        }

        /** @var list<int|string> $values */
        return ScopeConstraint::where($scope, $column, array_values($values));
    }
}
