<?php

declare(strict_types=1);

namespace Modules\IAM\Application\Services;

use Modules\IAM\Domain\Contracts\RoleCompositionInterface;
use Modules\IAM\Domain\Models\RoleTemplate;
use Modules\IAM\Domain\ValueObjects\EffectiveRoleProfile;

/**
 * Composes multiple role templates into one effective profile (ADR-039, Decision 2 & 3).
 * Pure — no persistence, no side effects. Powers preview and template→role compilation.
 *
 * Input order encodes priority: the FIRST template is the primary (its singular UI
 * defaults — dashboard, landing, preferences — win).
 */
class RoleCompositionService implements RoleCompositionInterface
{
    public function __construct(
        private readonly RoleConflictResolver $resolver,
        private readonly PermissionExpander $expander,
    ) {}

    /**
     * @param  list<RoleTemplate>  $templates
     */
    public function compose(array $templates): EffectiveRoleProfile
    {
        return $this->composeProfiles(array_map(
            static fn (RoleTemplate $t): EffectiveRoleProfile => $t->profile(),
            $templates,
        ));
    }

    /**
     * @param  list<EffectiveRoleProfile>  $profiles
     */
    public function composeProfiles(array $profiles): EffectiveRoleProfile
    {
        $profiles = array_values($profiles);

        if ($profiles === []) {
            return EffectiveRoleProfile::empty();
        }

        if (count($profiles) === 1) {
            return $this->expandProfile($profiles[0]);
        }

        $grants = [];
        $denies = [];
        $hiddenSets = [];
        $scopeMaps = [];
        $policyLists = [];
        $navLists = [];
        $quickLists = [];
        $sources = [];

        foreach ($profiles as $profile) {
            $grants[] = $this->expander->expand($profile->permissions);
            $denies[] = $this->expander->expand($profile->deniedPermissions);
            $hiddenSets[] = $profile->hiddenFields;
            $scopeMaps[] = $profile->scopes;
            $policyLists[] = $profile->policies;
            $navLists[] = $profile->navigation;
            $quickLists[] = $profile->quickActions;
            $sources = array_merge($sources, $profile->sources);
        }

        $allGrants = $this->resolver->union($grants);
        $allDenies = $this->resolver->union($denies);
        $primary = $profiles[0];

        return EffectiveRoleProfile::of([
            'permissions' => $this->resolver->resolvePermissions($allGrants, $allDenies),
            'deniedPermissions' => $allDenies,
            'hiddenFields' => $this->resolver->resolveHiddenFields($hiddenSets),
            'scopes' => $this->resolver->resolveScopes($scopeMaps),
            'policies' => $this->resolver->union($policyLists),
            'navigation' => $this->resolver->union($navLists),
            // Singular UI defaults follow the primary (highest-priority) template.
            'dashboard' => $primary->dashboard,
            'landingPage' => $this->firstLanding($profiles),
            'preferences' => $primary->preferences,
            'quickActions' => $this->resolver->union($quickLists),
            'sources' => array_values(array_unique($sources)),
        ]);
    }

    /** Expand a single profile's permission wildcards to concrete names. */
    private function expandProfile(EffectiveRoleProfile $profile): EffectiveRoleProfile
    {
        $denies = $this->expander->expand($profile->deniedPermissions);
        $grants = $this->resolver->resolvePermissions($this->expander->expand($profile->permissions), $denies);

        return EffectiveRoleProfile::of([
            'permissions' => $grants,
            'deniedPermissions' => $denies,
            'hiddenFields' => $profile->hiddenFields,
            'scopes' => $profile->scopes,
            'policies' => $profile->policies,
            'navigation' => $profile->navigation,
            'dashboard' => $profile->dashboard,
            'landingPage' => $profile->landingPage,
            'preferences' => $profile->preferences,
            'quickActions' => $profile->quickActions,
            'sources' => $profile->sources,
        ]);
    }

    /** @param list<EffectiveRoleProfile> $profiles */
    private function firstLanding(array $profiles): ?string
    {
        foreach ($profiles as $profile) {
            if ($profile->landingPage !== null && $profile->landingPage !== '') {
                return $profile->landingPage;
            }
        }

        return null;
    }
}
