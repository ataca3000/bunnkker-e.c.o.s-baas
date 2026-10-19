<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * TASK-PERMISSION-INTEGRATION-001 — Phase 1 of the approved Enterprise Permission Matrix.
 *
 * ┌─ SEEDS ONLY · ENFORCES NOTHING ─────────────────────────────────────────┐
 * │ This migration creates permissions and grants them. It changes no route,    │
 * │ no middleware and no behaviour, so applying it on its own cannot break a    │
 * │ running system. Enforcement is Phase 2/3, wired in routes/api.php.          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Category A (CRUD) and Category B (operational) only. Category C — the
 * sensitive operations: refund, void, close_shift, override_cost,
 * verify_payment, brand transfer, ledger deletes — is DELIBERATELY ABSENT and
 * awaits CTO sign-off on who may hold each one.
 *
 * The grammar follows what ECOS already uses: `namespace.resource.action`, with
 * the two-part `namespace.action` reserved for module-wide concerns, exactly as
 * `operations.view` and `routing.optimize` already do.
 *
 * ROLE GRANTS are deliberately conservative. `company-admin` receives the full
 * set — it already holds 77 permissions spanning every module, so this widens
 * nothing conceptually — and `viewer` receives the `.view` permissions only.
 * The four specialist roles (warehouse-manager, purchasing, sales,
 * inventory-operator) are LEFT UNTOUCHED: deciding which of them may allocate
 * stock or dispatch a trip is a business decision, not a migration's to make.
 * `super-admin` is is_system and bypasses the middleware entirely.
 */
return new class extends Migration
{
    /**
     * resource => [actions]
     *
     * @return array<string, array<string, array<int, string>>>
     */
    private function matrix(): array
    {
        $crud = ['view', 'create', 'update', 'delete'];

        return [
            // ── Extensions to existing namespaces ────────────────────────────
            'organization' => [
                'brands' => $crud,
                'business_accounts' => $crud,
                'teams' => $crud,
            ],
            'sales' => [
                'customers' => ['view', 'create', 'update', 'export', 'merge'],
            ],
            'inventory' => [
                'raw_materials' => $crud,
                'recipes' => $crud,
                'waste' => ['view', 'create', 'update', 'investigate'],
                'transfers' => ['view', 'create', 'update'],
            ],

            // ── New namespaces ───────────────────────────────────────────────
            'engineering' => [
                'tasks' => array_merge($crud, ['transition']),
                'releases' => array_merge($crud, ['analyze']),
                'workers' => array_merge($crud, ['start', 'stop', 'drain', 'heartbeat']),
                'queue' => ['view', 'enqueue', 'prioritize', 'drain', 'pause', 'resume'],
                'repair' => ['view', 'create', 'update', 'retry', 'analyze'],
                'ai_reviews' => ['view', 'create', 'run'],
                'pipelines' => ['view', 'create', 'retry'],
            ],
            'marketing' => [
                'campaigns' => array_merge($crud, ['activate', 'pause']),
                'initiatives' => $crud,
                'studio' => array_merge($crud, ['preview']),
                'automation' => array_merge($crud, ['activate', 'pause']),
                'segments' => $crud,
                'workflows' => array_merge($crud, ['activate', 'pause']),
                'templates' => $crud,
                'providers' => ['view', 'update', 'connect', 'disconnect'],
                'meta' => ['view', 'update', 'sync', 'connect'],
                'mapping_profiles' => $crud,
                'relationships' => $crud,
                'assets' => array_merge($crud, ['sync']),
            ],
            'distribution' => [
                'trips' => ['view', 'create', 'update', 'load', 'unload'],
                'stops' => ['view', 'create', 'update', 'generate', 'start', 'complete', 'proof'],
                'loading' => ['view', 'create', 'update'],
                'custody' => ['view', 'create', 'update'],
                'exceptions' => ['view', 'create', 'update'],
                'returns' => ['view', 'create', 'update'],
            ],
            'fulfillment' => [
                'waves' => ['view', 'create', 'update', 'allocate', 'release'],
                'allocations' => ['view', 'create', 'update', 'reserve', 'release'],
                'pools' => ['view', 'update'],
            ],
            'preparation' => [
                'waves' => ['view', 'create', 'update', 'start', 'complete'],
                'sessions' => ['view', 'create', 'update', 'assign'],
                'batches' => ['view', 'create', 'update'],
            ],
            'pos' => [
                'carts' => ['view', 'create', 'update', 'add_item', 'checkout'],
                'shifts' => ['view', 'create', 'update', 'open_shift'],
                'payments' => ['view', 'create'],
            ],
            'cep' => [
                'conversations' => ['view', 'create', 'update', 'assign'],
                'leads' => ['view', 'create', 'update', 'qualify', 'disqualify'],
                'notes' => ['view', 'create', 'update'],
            ],
            'omnichannel' => [
                'conversations' => ['view', 'create', 'update', 'assign', 'auto_route'],
                'providers' => ['view', 'update'],
                'routing_rules' => $crud,
                'macros' => $crud,
            ],
            'geography' => [
                'governorates' => $crud,
                'cities' => $crud,
                'zones' => array_merge($crud, ['reorder']),
                'aliases' => $crud,
            ],
            'bae' => [
                'attributions' => ['view', 'recalculate'],
                'timeline' => ['view'],
            ],
            'cost' => [
                'cost_management' => ['view', 'recalculate'],
                'price_review' => ['view', 'update'],
            ],
            'claude_bridge' => [
                'tasks' => ['view', 'create', 'update', 'queue', 'start', 'mark_merged'],
                'workers' => ['view', 'create', 'update'],
                'settings' => ['view', 'update'],
            ],
            'configuration' => [
                'company' => ['view', 'update'],
                'brand' => ['view', 'update'],
                'policies' => ['view', 'update'],
                'master_geography' => ['view', 'create', 'update'],
            ],
        ];
    }

    /** @return array<int, array{0: string, 1: string, 2: string, 3: string}> */
    private function permissions(): array
    {
        $rows = [];

        foreach ($this->matrix() as $namespace => $resources) {
            foreach ($resources as $resource => $actions) {
                foreach ($actions as $action) {
                    $rows[] = [
                        $namespace.'.'.$resource.'.'.$action,
                        $namespace,
                        $resource,
                        $action,
                    ];
                }
            }
        }

        return $rows;
    }

    public function up(): void
    {
        if (! Schema::hasTable('permissions')) {
            return;
        }

        $now = now();
        $created = [];

        foreach ($this->permissions() as [$name, $module, $resource, $action]) {
            if (DB::table('permissions')->where('name', $name)->exists()) {
                continue;
            }

            $id = (string) Str::uuid();

            DB::table('permissions')->insert([
                'id' => $id,
                'name' => $name,
                'module' => $module,
                'resource' => $resource,
                'action' => $action,
                'description' => ucfirst(str_replace('_', ' ', $action)).' '.str_replace('_', ' ', $resource),
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $created[$name] = $id;
        }

        if (! Schema::hasTable('roles') || ! Schema::hasTable('role_permissions') || $created === []) {
            return;
        }

        $admin = DB::table('roles')->where('slug', 'company-admin')->value('id');
        $viewer = DB::table('roles')->where('slug', 'viewer')->value('id');

        foreach ($created as $name => $permissionId) {
            // company-admin gets the whole matrix; viewer gets reads only.
            $targets = [];

            if ($admin !== null) {
                $targets[] = $admin;
            }

            if ($viewer !== null && str_ends_with($name, '.view')) {
                $targets[] = $viewer;
            }

            foreach ($targets as $roleId) {
                $exists = DB::table('role_permissions')
                    ->where('role_id', $roleId)
                    ->where('permission_id', $permissionId)
                    ->exists();

                if ($exists) {
                    continue;
                }

                DB::table('role_permissions')->insert([
                    'id' => (string) Str::uuid(),
                    'role_id' => $roleId,
                    'permission_id' => $permissionId,
                    'effect' => 'allow',
                    'conditions' => null,
                    'expires_at' => null,
                    'created_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('permissions')) {
            return;
        }

        $names = array_column($this->permissions(), 0);

        $ids = DB::table('permissions')->whereIn('name', $names)->pluck('id');

        if (Schema::hasTable('role_permissions')) {
            DB::table('role_permissions')->whereIn('permission_id', $ids)->delete();
        }

        DB::table('permissions')->whereIn('name', $names)->delete();
    }
};
