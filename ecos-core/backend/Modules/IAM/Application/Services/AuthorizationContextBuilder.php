<?php

declare(strict_types=1);

namespace Modules\IAM\Application\Services;

use App\Models\User;
use Modules\IAM\Domain\Contracts\PermissionServiceInterface;
use Modules\IAM\Domain\Models\UserTemplateAssignment;

/**
 * Builds the complete authorization context delivered to the frontend (TASK-IAM-005 /
 * ADR-041). This is the SINGLE payload the UI consumes — permissions, visibility, scope,
 * policies, navigation, dashboard, landing, feature flags, effective templates — so the
 * client never issues extra authorization requests. Backend stays authoritative; this is
 * for UX only.
 */
class AuthorizationContextBuilder
{
    public function __construct(
        private readonly PermissionServiceInterface $permissions,
        private readonly UserRoleAssignmentService $roles,
    ) {}

    /**
     * @return array<string,mixed>
     */
    public function build(User $user): array
    {
        $isSystem = $this->permissions->userHasSystemRole($user);
        $profile = $this->roles->effectiveProfile($user);

        $templates = UserTemplateAssignment::with('template')
            ->where('user_id', $user->getKey())
            ->orderByDesc('is_primary')
            ->get()
            ->map(fn (UserTemplateAssignment $a): ?array => $a->template === null ? null : [
                'key' => $a->template->key,
                'name' => $a->template->name,
                'category' => $a->template->category,
                'is_primary' => $a->is_primary,
            ])
            ->filter()
            ->values()
            ->all();

        return [
            'is_system' => $isSystem,
            'permissions' => $this->permissions->getUserPermissions($user),
            'visibility' => ['hidden_fields' => $profile->hiddenFields],
            'scopes' => $profile->scopes,
            'policies' => $profile->policies,
            'navigation' => $profile->navigation,
            'dashboard' => $profile->dashboard,
            'landing_page' => $profile->landingPage,
            'preferences' => $profile->preferences,
            'quick_actions' => $profile->quickActions,
            'templates' => $templates,
            // Org-level feature flags. Empty map = everything enabled (forward-compatible;
            // a future org feature-flag store fills this without a frontend change).
            'feature_flags' => $this->featureFlags($user),
        ];
    }

    /**
     * @return array<string,bool>
     */
    private function featureFlags(User $user): array
    {
        // No per-organization feature-flag store yet; default to all-enabled. The frontend
        // treats an absent/true flag as enabled, so this is safe to expand later.
        return [];
    }
}
