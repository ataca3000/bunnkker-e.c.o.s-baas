<?php

declare(strict_types=1);

namespace Modules\IAM\Application\Services;

use Modules\IAM\Domain\Enums\DataScope;

/**
 * Deterministic conflict-resolution rules for composing role templates (ADR-039, Decision 3).
 *
 * - permissions: union of grants minus explicit denies (deny wins)
 * - data scope: widest scope wins (per resource)
 * - visibility: a field is hidden only if EVERY profile hides it (intersection — any grant reveals)
 * - policies/navigation: union
 * - singular UI (dashboard/landing/preferences): highest-priority profile wins
 */
class RoleConflictResolver
{
    /** DataScope width rank — higher is wider/less restrictive. */
    private const SCOPE_RANK = [
        'self' => 10,
        'team' => 20,
        'branch' => 30,
        'warehouse' => 40,
        'channel' => 50,
        'department' => 60,
        'business_unit' => 70,
        'region' => 80,
        'company' => 90,
        'custom' => 5,
        'all' => 100,
    ];

    /**
     * @param  list<string>  $granted
     * @param  list<string>  $denied
     * @return list<string>
     */
    public function resolvePermissions(array $granted, array $denied): array
    {
        return array_values(array_diff(array_unique($granted), array_unique($denied)));
    }

    /** Widest of two scope values wins. */
    public function widerScope(string $a, string $b): string
    {
        $ra = self::SCOPE_RANK[$a] ?? self::SCOPE_RANK[DataScope::ALL->value];
        $rb = self::SCOPE_RANK[$b] ?? self::SCOPE_RANK[DataScope::ALL->value];

        return $ra >= $rb ? $a : $b;
    }

    /**
     * Merge per-resource scope maps, widest-wins. A resource absent from a map defaults
     * to 'all' (unrestricted) for that profile, so the widest across the set is 'all'
     * unless every profile restricts it.
     *
     * @param  list<array<string,string>>  $scopeMaps
     * @return array<string,string>
     */
    public function resolveScopes(array $scopeMaps): array
    {
        $resources = [];
        foreach ($scopeMaps as $map) {
            foreach ($map as $resource => $_) {
                $resources[$resource] = true;
            }
        }

        $resolved = [];
        foreach (array_keys($resources) as $resource) {
            $winner = null;
            foreach ($scopeMaps as $map) {
                // A profile that doesn't mention the resource grants it unrestricted.
                $scope = $map[$resource] ?? DataScope::ALL->value;
                $winner = $winner === null ? $scope : $this->widerScope($winner, $scope);
            }
            // Only record genuinely restrictive outcomes; 'all' is the default anyway.
            if ($winner !== null && $winner !== DataScope::ALL->value) {
                $resolved[$resource] = $winner;
            }
        }

        return $resolved;
    }

    /**
     * A field stays hidden only if it is hidden in EVERY profile (intersection).
     *
     * @param  list<list<string>>  $hiddenSets
     * @return list<string>
     */
    public function resolveHiddenFields(array $hiddenSets): array
    {
        if ($hiddenSets === []) {
            return [];
        }

        $intersection = array_unique($hiddenSets[0]);
        foreach (array_slice($hiddenSets, 1) as $set) {
            $intersection = array_intersect($intersection, $set);
        }

        return array_values($intersection);
    }

    /**
     * @param  list<list<string>>  $lists
     * @return list<string>
     */
    public function union(array $lists): array
    {
        return array_values(array_unique(array_merge(...($lists ?: [[]]))));
    }
}
