<?php

declare(strict_types=1);

namespace Modules\IAM\Application\Services;

use Illuminate\Support\Facades\DB;
use Modules\IAM\Domain\Exceptions\UnknownTemplatePermissionException;
use Modules\IAM\Domain\Models\Permission;
use Modules\IAM\Domain\Models\Role;
use Modules\IAM\Domain\Models\RoleTemplate;

/**
 * Compiles a Role Template (ADR-039) into a runtime Role + role_permissions (ADR-040,
 * Decision 2). This closes the authoring→runtime loop: it is the ONLY place that sets
 * role_templates.role_id, so the Authorization Platform keeps reading roles unchanged.
 *
 * Idempotent: re-compiling re-syncs the linked role's grants from the current definition.
 */
class RoleTemplateCompiler
{
    public function __construct(
        private readonly RoleCompositionService $composition,
        private readonly PermissionExpander $expander,
    ) {}

    /** Ensure the template has a linked runtime role whose grants match its profile. */
    public function compile(RoleTemplate $template): Role
    {
        $profile = $this->composition->composeProfiles([$template->profile()]);

        // Validate BEFORE touching any state. resolveRole() creates a `tpl-*` role
        // and writes role_templates.role_id, so validating after it left an empty
        // role behind for every template that failed — a rejected compile is not
        // supposed to change anything (TASK-IAM-HOTFIX-001, item 4).
        //
        // All failures are collected before throwing: reporting one unknown token
        // per run would make correcting a template repeated trial (BUG-GL-011).
        $names = array_values(array_filter(
            $profile->permissions,
            static fn (string $name): bool => substr_count($name, '.') >= 1,
        ));

        $resolved = Permission::query()->whereIn('name', $names)->get()->keyBy('name');
        $unknown = array_values(array_diff($names, $resolved->keys()->all()));

        // A wildcard that matches nothing is the same defect wearing a disguise:
        // `shipping.*` and `manufacturing.*` name domains the platform never
        // seeded, expand to zero tokens, and so slipped past the unknown-token
        // check entirely — the template compiled and granted nothing, silently.
        // That is precisely the failure BUG-GL-011 was about, so it fails too.
        $catalog = $this->expander->catalogNames();
        foreach ($this->wildcardTokens($template) as $token) {
            $prefix = substr($token, 0, -1);
            $matches = array_filter($catalog, static fn (string $n): bool => str_starts_with($n, $prefix));

            if ($matches === []) {
                $unknown[] = $token;
            }
        }

        if ($unknown !== []) {
            throw UnknownTemplatePermissionException::forTemplate($template->key, array_values(array_unique($unknown)));
        }

        $role = $this->resolveRole($template);

        $pivot = [];
        foreach ($names as $name) {
            $resource = $this->resourceOf($name);
            $pivot[$resolved[$name]->id] = [
                'effect' => 'allow',
                'data_scope' => $profile->scopeFor($resource),
            ];
        }

        // The compiled role is fully owned by the template — sync (replace) its grants.
        $role->permissions()->sync($pivot);

        return $role;
    }

    private function resolveRole(RoleTemplate $template): Role
    {
        if ($template->role_id !== null) {
            $existing = Role::find($template->role_id);
            if ($existing !== null) {
                return $existing;
            }
        }

        $role = Role::firstOrCreate(
            ['slug' => 'tpl-'.$template->key],
            ['name' => $template->name, 'description' => 'Compiled from role template: '.$template->key, 'is_system' => false],
        );

        // Link without mutating a system template through the guarded repository.
        DB::table('role_templates')->where('id', $template->id)->update(['role_id' => $role->id]);
        $template->setAttribute('role_id', $role->id);

        return $role;
    }

    /**
     * The wildcard tokens a template declares, before expansion.
     *
     * @return list<string>
     */
    private function wildcardTokens(RoleTemplate $template): array
    {
        $definition = $template->definition;
        $tokens = is_array($definition) ? ($definition['permissions'] ?? []) : [];

        if (! is_array($tokens)) {
            return [];
        }

        return array_values(array_filter(
            array_map(static fn ($t): string => (string) $t, $tokens),
            static fn (string $t): bool => $t !== '*' && str_ends_with($t, '.*'),
        ));
    }

    /** "sales.orders.view" → "sales.orders" (the scope key). */
    private function resourceOf(string $name): string
    {
        $parts = explode('.', $name);
        if (count($parts) <= 2) {
            return $parts[0];
        }

        return implode('.', array_slice($parts, 0, -1));
    }
}
