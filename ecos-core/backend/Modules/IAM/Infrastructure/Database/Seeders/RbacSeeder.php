<?php

declare(strict_types=1);

namespace Modules\IAM\Infrastructure\Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\IAM\Domain\Models\Permission;
use Modules\IAM\Domain\Models\Role;
use Throwable;

/**
 * Seeds roles and permissions from config/permissions.php.
 *
 * Safe to re-run: cleans up old two-segment permission names then uses
 * firstOrCreate for every new record.
 *
 * Permission format: domain.resource.action  (e.g. inventory.products.view)
 * Role is_system:    driven by config — never hardcoded in application logic.
 */
final class RbacSeeder extends Seeder
{
    public function run(): void
    {
        // ── 0. NO CLEANUP. This seeder never deletes a permission. ────────────
        //
        // ┌─ WHY THE CLEANUP WAS REMOVED ──────────────────────────────────┐
        // │ This step used to delete every permission whose name contained  │
        // │ exactly one dot, on the assumption that one dot meant the old   │
        // │ module.action format left over from the 001 → 001A migration.   │
        // │                                                                  │
        // │ Name shape does not mean that. Modules register two-segment      │
        // │ permissions legitimately from their own migrations, and the      │
        // │ rule deleted 19 live ones on every run — every Logistics fleet,  │
        // │ dispatch, delivery, routing, carrier and network permission,     │
        // │ plus finance.admin. FleetPolicy authorises against fleet.view    │
        // │ and fleet.manage, so after a routine `db:seed` those endpoints   │
        // │ denied everyone, silently: the permission was simply gone, so no │
        // │ role could hold it and every request was a legitimate 403.       │
        // │                                                                  │
        // │ There is no signal that separates a stale leftover from a live   │
        // │ module registration — both are simply rows present before this   │
        // │ seeder runs. So the rule could not be narrowed, only removed.    │
        // │ A lingering obsolete permission is inert: nothing routes to it   │
        // │ and no role is granted it. A deleted live one breaks             │
        // │ authorisation. Between an unused row and a locked-out module,    │
        // │ the unused row is the safe failure.                              │
        // │                                                                  │
        // │ Do not reintroduce a name-shape rule here. If genuinely obsolete │
        // │ permissions ever need removing, that belongs in a migration that │
        // │ names them explicitly, where the list is reviewable.             │
        // └──────────────────────────────────────────────────────────────────┘

        // ── 1. Create every permission (domain.resource.action) ───────────────
        $allPermissions = [];

        foreach (config('permissions.modules', []) as $domain => $resources) {
            foreach ($resources as $resource => $actions) {
                foreach ($actions as $action) {
                    $name = "{$domain}.{$resource}.{$action}";

                    /** @var Permission $permission */
                    $permission = Permission::firstOrCreate(
                        ['name' => $name],
                        [
                            'module' => $domain,
                            'resource' => $resource,
                            'action' => $action,
                            'description' => ucfirst($action).' '.str_replace('_', ' ', $resource),
                        ],
                    );

                    $allPermissions[$name] = $permission;
                }
            }
        }

        $this->command->info(sprintf(
            '  RBAC: %d permissions seeded.',
            count($allPermissions),
        ));

        // ── 1b. Adopt permissions registered outside this catalogue ───────────
        // Finance, HR, CRM and several Logistics sub-domains register their
        // permissions from module migrations (DB::table('permissions')->insert)
        // rather than from config/permissions.modules. Those rows exist, but the
        // grant loop below resolves names against $allPermissions only, so any
        // role_permissions entry naming one was silently discarded — no error,
        // no warning. That is why finance.* and hr.* held zero grants across all
        // 27 roles while 95 such permissions existed in the table.
        //
        // Loading the persisted set closes that gap without changing either
        // registration mechanism: the catalogue still creates its own
        // permissions above, and module migrations still own theirs.
        foreach (Permission::all() as $persisted) {
            $allPermissions[$persisted->name] ??= $persisted;
        }

        $this->command->info(sprintf(
            '  RBAC: %d permissions resolvable for granting (incl. module-registered).',
            count($allPermissions),
        ));

        // ── 2. Create every role ───────────────────────────────────────────────
        $roles = [];

        foreach (config('permissions.roles', []) as $slug => $def) {
            $roles[$slug] = Role::firstOrCreate(
                ['slug' => $slug],
                [
                    'name' => $def['name'],
                    'is_system' => $def['is_system'],
                ],
            );
        }

        $this->command->info(sprintf(
            '  RBAC: %d roles seeded.',
            count($roles),
        ));

        // ── 3. Assign permissions to roles ─────────────────────────────────────
        //
        // Super Admin is intentionally excluded from role_permissions.
        // System roles gain access through Gate::before() — no per-permission
        // rows required. New permissions automatically apply without re-seeding.
        //
        $rolePermissionMap = config('permissions.role_permissions', []);

        foreach ($rolePermissionMap as $slug => $domainResourceGrants) {
            if (! isset($roles[$slug])) {
                continue;
            }

            $role = $roles[$slug];
            $permissionIds = [];

            foreach ($domainResourceGrants as $domainResource => $actions) {
                foreach ($actions as $action) {
                    $name = "{$domainResource}.{$action}"; // e.g. inventory.products.view
                    if (isset($allPermissions[$name])) {
                        $permissionIds[] = $allPermissions[$name]->id;
                    }
                }
            }

            // syncWithoutDetaching: idempotent; re-running never removes
            // permissions that were manually granted outside the seeder.
            $role->permissions()->syncWithoutDetaching($permissionIds);

            $this->command->line(sprintf(
                '    → %s (%d permissions)',
                $role->name,
                count($permissionIds),
            ));
        }

        // ── 4. Flush RBAC cache after seeding ─────────────────────────────────
        try {
            cache()->flush();
        } catch (Throwable) {
            // Non-fatal: cache may not be configured during CI.
        }
    }
}
