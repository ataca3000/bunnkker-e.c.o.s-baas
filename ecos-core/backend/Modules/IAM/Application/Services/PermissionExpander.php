<?php

declare(strict_types=1);

namespace Modules\IAM\Application\Services;

use Illuminate\Support\Facades\Schema;
use Modules\IAM\Domain\Models\Permission;

/**
 * Expands permission tokens in a template definition into concrete permission names
 * (ADR-039, Decision 6). Supports wildcards resolved against the live permission catalog:
 *   "*"                     → every permission
 *   "inventory.*"           → every permission in the inventory domain
 *   "inventory.products.*"  → every action on inventory.products
 * Exact three-segment tokens (incl. not-yet-seeded field permissions like
 * "inventory.products.view_cost") pass through unchanged.
 */
class PermissionExpander
{
    /** @var list<string>|null */
    private ?array $catalog = null;

    /**
     * @param  list<string>  $tokens
     * @return list<string> concrete, de-duplicated permission names
     */
    public function expand(array $tokens): array
    {
        $catalog = $this->catalogNames();
        $out = [];

        foreach ($tokens as $token) {
            $token = (string) $token;

            if ($token === '*') {
                $out = array_merge($out, $catalog);

                continue;
            }

            if (str_ends_with($token, '.*')) {
                $prefix = substr($token, 0, -1); // keep the trailing dot: "inventory."
                foreach ($catalog as $name) {
                    if (str_starts_with($name, $prefix)) {
                        $out[] = $name;
                    }
                }

                continue;
            }

            // Exact token — keep as-is (may be a sensitive-field permission not in the catalog yet).
            $out[] = $token;
        }

        return array_values(array_unique($out));
    }

    /**
     * Flatten the permission catalog (config/permissions.php modules) to full names.
     *
     * @return list<string>
     */
    public function catalogNames(): array
    {
        if ($this->catalog !== null) {
            return $this->catalog;
        }

        // The permissions TABLE is the source of truth (TASK-IAM-HOTFIX-001).
        //
        // This method used to read config('permissions.modules') alone. That
        // config declares 183 names; the table holds 578. Finance, HR, CRM,
        // marketing, engineering and the logistics sub-domains register their
        // permissions from module migrations, never through the config file, so
        // `finance.*` expanded to 0 while 54 finance permissions existed and the
        // AuthorizationGateway happily enforced them (BUG-GL-011).
        //
        // RbacSeeder already resolved this exact divergence the same way — it
        // adopts Permission::all() after seeding the config-declared set,
        // documenting that finance.* and hr.* "held zero grants across all 27
        // roles while 95 such permissions existed in the table". Expansion now
        // reads the same source that enforcement does, so the two cannot drift.
        if (Schema::hasTable('permissions')) {
            $names = Permission::query()->pluck('name')->all();

            if ($names !== []) {
                return $this->catalog = array_values(array_unique($names));
            }
        }

        // Fallback: before migrations run (or on an unseeded database) the table
        // is absent or empty. Config still describes the base catalogue, which
        // keeps boot-time and first-seed behaviour working.
        /** @var array<string,array<string,list<string>>> $modules */
        $modules = (array) config('permissions.modules', []);
        $names = [];

        foreach ($modules as $domain => $resources) {
            foreach ((array) $resources as $resource => $actions) {
                foreach ((array) $actions as $action) {
                    $names[] = "{$domain}.{$resource}.{$action}";
                }
            }
        }

        return $this->catalog = array_values(array_unique($names));
    }
}
