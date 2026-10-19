<?php

declare(strict_types=1);

namespace Modules\IAM\Application\Services;

use Modules\IAM\Domain\Contracts\PermissionRegistryInterface;
use Modules\IAM\Domain\Models\Permission;
use Modules\IAM\Domain\ValueObjects\PermissionName;

/**
 * PermissionRegistry — the Enterprise Permission Registry (TASK-IAM-002 / ADR-038).
 *
 * The single source of truth for the permission catalog. Discovers the existing
 * `config/permissions.php` catalog, accepts self-registration from modules,
 * validates every name through PermissionName, de-duplicates by canonical value,
 * exposes a deterministic version fingerprint, and can idempotently sync to the DB.
 *
 * Phase 1 = infrastructure only:
 *   • No DB query happens during construction (discovery reads config only).
 *   • sync() is never called automatically — a request never writes permissions.
 *   • No existing permission rows are altered, so runtime behaviour is unchanged.
 *
 * Registered as a singleton so a module can register once and every consumer sees
 * the same catalog within the request lifecycle.
 */
final class PermissionRegistry implements PermissionRegistryInterface
{
    /** @var array<string, PermissionName> keyed by canonical value for O(1) de-dup */
    private array $registered = [];

    public function __construct()
    {
        $this->discoverFromConfig();
    }

    public function register(string $module, array $resources): void
    {
        foreach ($resources as $resource => $actions) {
            foreach ((array) $actions as $action) {
                // register() is strict: a module registering a malformed name is a bug.
                $this->add("{$module}.{$resource}.{$action}");
            }
        }
    }

    public function add(string|PermissionName $name): void
    {
        $permission = $name instanceof PermissionName ? $name : PermissionName::from($name);
        $this->registered[$permission->value()] = $permission;
    }

    public function has(string|PermissionName $name): bool
    {
        $permission = $name instanceof PermissionName ? $name : PermissionName::tryFrom($name);

        return $permission !== null && isset($this->registered[$permission->value()]);
    }

    public function all(): array
    {
        $names = array_keys($this->registered);
        sort($names);

        return array_values($names);
    }

    public function definitions(): array
    {
        return array_values($this->registered);
    }

    public function count(): int
    {
        return count($this->registered);
    }

    public function version(): string
    {
        return substr(hash('sha256', implode('|', $this->all())), 0, 16);
    }

    public function sync(): array
    {
        $created = 0;
        $existing = 0;

        foreach ($this->definitions() as $permission) {
            $model = Permission::firstOrCreate(
                ['name' => $permission->value()],
                [
                    'module' => $permission->module(),
                    'resource' => $permission->resource(),
                    'action' => $permission->action(),
                ],
            );

            $model->wasRecentlyCreated ? $created++ : $existing++;
        }

        return [
            'created' => $created,
            'existing' => $existing,
            'total' => $created + $existing,
        ];
    }

    /**
     * Seed the registry from the existing central catalog. Tolerant by design:
     * names that do not fit the PermissionName grammar are skipped rather than
     * throwing, so a stray legacy entry in config can never break resolution.
     */
    private function discoverFromConfig(): void
    {
        /** @var array<string, array<string, array<int, string>>> $modules */
        $modules = (array) config('permissions.modules', []);

        foreach ($modules as $module => $resources) {
            foreach ((array) $resources as $resource => $actions) {
                foreach ((array) $actions as $action) {
                    $permission = PermissionName::tryFrom("{$module}.{$resource}.{$action}");

                    if ($permission !== null) {
                        $this->registered[$permission->value()] = $permission;
                    }
                }
            }
        }
    }
}
