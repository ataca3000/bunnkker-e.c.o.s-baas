<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Contracts;

use Modules\IAM\Domain\ValueObjects\PermissionName;

/**
 * PermissionRegistryInterface — the single source of truth for the permission catalog.
 *
 * TASK-IAM-002 / ADR-038 §Decision 4. Modules register their permissions here
 * instead of scattering string literals or seeding independently. The registry
 * discovers, validates, de-duplicates, versions, and (on demand) synchronises the
 * catalog to the database.
 *
 * Phase 1 is infrastructure only: the registry is operational (register/validate/
 * dedupe/version/sync work and are tested) but nothing auto-runs on boot and no
 * existing permission rows are migrated — so runtime behaviour is unchanged.
 */
interface PermissionRegistryInterface
{
    /**
     * Register a module's permissions.
     *
     * @param  string  $module  the top-level domain, e.g. "inventory"
     * @param  array<string, array<int, string>>  $resources  resource => [actions]
     *
     * @throws \Modules\IAM\Domain\Exceptions\InvalidPermissionNameException
     */
    public function register(string $module, array $resources): void;

    /**
     * Register a single fully-qualified permission name (validated + de-duplicated).
     *
     * @throws \Modules\IAM\Domain\Exceptions\InvalidPermissionNameException
     */
    public function add(string|PermissionName $name): void;

    /**
     * Is the given permission known to the registry? (canonicalised before lookup)
     */
    public function has(string|PermissionName $name): bool;

    /**
     * All registered permission names, canonical, de-duplicated, sorted.
     *
     * @return list<string>
     */
    public function all(): array;

    /**
     * All registered permissions as value objects.
     *
     * @return list<PermissionName>
     */
    public function definitions(): array;

    /**
     * Count of distinct registered permissions.
     */
    public function count(): int;

    /**
     * A deterministic version fingerprint of the current catalog. Changes whenever
     * the set of registered permissions changes — the seam for future cache-busting
     * and migration detection.
     */
    public function version(): string;

    /**
     * Idempotently persist the registered catalog to the `permissions` table.
     *
     * Non-destructive: uses first-or-create, never deletes. NOT called automatically
     * during a request — invoked by a seeder/console command only.
     *
     * @return array{created: int, existing: int, total: int}
     */
    public function sync(): array;
}
