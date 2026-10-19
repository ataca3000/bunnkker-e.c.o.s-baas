<?php

declare(strict_types=1);

namespace Modules\IAM\Application\Services;

use App\Models\User;
use Modules\IAM\Domain\Contracts\PermissionServiceInterface;
use Modules\IAM\Domain\Contracts\RoleCompositionInterface;
use Modules\IAM\Domain\Contracts\RoleTemplateRepositoryInterface;
use Modules\IAM\Domain\Models\RoleTemplate;
use Modules\IAM\Domain\Models\UserTemplateAssignment;
use Modules\IAM\Domain\ValueObjects\EffectiveRoleProfile;

/**
 * Assigns Role Templates to users — the ONLY path to granting a user access (ADR-040,
 * Decision 2). There is no direct permission assignment. Each assignment compiles the
 * template to a runtime role and attaches it, so the Authorization Platform is unchanged.
 */
class UserRoleAssignmentService
{
    public function __construct(
        private readonly RoleTemplateRepositoryInterface $templates,
        private readonly RoleTemplateCompiler $compiler,
        private readonly RoleCompositionInterface $composition,
        private readonly PermissionServiceInterface $permissions,
        private readonly UserAuditService $audit,
    ) {}

    public function assignTemplate(User $user, RoleTemplate|string $template, bool $primary = false, ?int $actorId = null): UserTemplateAssignment
    {
        $template = $this->resolve($template);
        $role = $this->compiler->compile($template);

        $user->assignRole($role);

        $assignment = UserTemplateAssignment::firstOrNew([
            'user_id' => $user->getKey(),
            'role_template_id' => $template->id,
        ]);
        $assignment->is_primary = $primary;
        $assignment->assigned_by = $actorId;
        $assignment->assigned_at = now();
        $assignment->save();

        if ($primary) {
            $this->markPrimary($user, $template->id);
        }

        $this->permissions->invalidateUserCache((int) $user->getKey());
        $this->audit->log('template_assigned', $user, [], ['template' => $template->key, 'primary' => $primary]);

        return $assignment;
    }

    public function removeTemplate(User $user, RoleTemplate|string $template): void
    {
        $template = $this->resolve($template);

        if ($template->role_id !== null) {
            $user->roles()->detach($template->role_id);
        }
        UserTemplateAssignment::where('user_id', $user->getKey())
            ->where('role_template_id', $template->id)
            ->delete();

        $this->permissions->invalidateUserCache((int) $user->getKey());
        $this->audit->log('template_removed', $user, ['template' => $template->key], []);
    }

    public function setPrimary(User $user, RoleTemplate|string $template): void
    {
        $template = $this->resolve($template);
        $this->markPrimary($user, $template->id);
        $this->audit->log('primary_template_set', $user, [], ['template' => $template->key]);
    }

    /**
     * The user's fully-resolved effective profile — composed from their assigned templates,
     * primary first. Drives effective permissions/visibility/scope/policies.
     */
    public function effectiveProfile(User $user): EffectiveRoleProfile
    {
        $assignments = UserTemplateAssignment::with('template')
            ->where('user_id', $user->getKey())
            ->orderByDesc('is_primary')
            ->get();

        $templates = $assignments
            ->map(fn (UserTemplateAssignment $a): ?RoleTemplate => $a->template)
            ->filter()
            ->values()
            ->all();

        return $this->composition->compose($templates);
    }

    private function markPrimary(User $user, string $templateId): void
    {
        UserTemplateAssignment::where('user_id', $user->getKey())->update(['is_primary' => false]);
        UserTemplateAssignment::where('user_id', $user->getKey())
            ->where('role_template_id', $templateId)
            ->update(['is_primary' => true]);
    }

    private function resolve(RoleTemplate|string $template): RoleTemplate
    {
        if ($template instanceof RoleTemplate) {
            return $template;
        }

        $model = $this->templates->findByKey($template);
        if ($model === null) {
            throw new \InvalidArgumentException("Unknown role template '{$template}'.");
        }

        return $model;
    }
}
