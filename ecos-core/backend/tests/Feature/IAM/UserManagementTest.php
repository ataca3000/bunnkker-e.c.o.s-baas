<?php

declare(strict_types=1);

namespace Tests\Feature\IAM;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Modules\IAM\Application\Services\RoleTemplateCompiler;
use Modules\IAM\Application\Services\UserIdentityService;
use Modules\IAM\Application\Services\UserInvitationService;
use Modules\IAM\Application\Services\UserLifecycleService;
use Modules\IAM\Application\Services\UserOrganizationAssignmentService;
use Modules\IAM\Application\Services\UserRoleAssignmentService;
use Modules\IAM\Application\Services\UserSessionService;
use Modules\IAM\Domain\Contracts\PermissionServiceInterface;
use Modules\IAM\Domain\Contracts\RoleTemplateRepositoryInterface;
use Modules\IAM\Domain\Enums\UserStatus;
use Modules\IAM\Domain\Exceptions\InvalidUserTransitionException;
use Modules\IAM\Domain\Exceptions\UserSecurityRuleException;
use Modules\IAM\Domain\Models\Role;
use Modules\IAM\Domain\Models\RoleTemplate;
use Modules\IAM\Domain\Models\UserInvitation;
use Modules\IAM\Domain\Models\UserTemplateAssignment;
use Tests\TestCase;

/**
 * TASK-IAM-004 — Enterprise User Management Platform (ADR-040).
 */
class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    private function identity(): UserIdentityService
    {
        return app(UserIdentityService::class);
    }

    private function draft(string $email = 'jane@ecos.test', array $extra = []): User
    {
        return $this->identity()->createDraft(array_merge(['name' => 'Jane', 'email' => $email], $extra));
    }

    private function customTemplate(string $key, array $definition): RoleTemplate
    {
        return app(RoleTemplateRepositoryInterface::class)->createCustom([
            'key' => $key,
            'name' => ucfirst($key),
            'category' => 'custom',
            'definition' => $definition,
        ]);
    }

    // ── Identity ──────────────────────────────────────────────────────────────

    public function test_create_draft_user_starts_in_draft_and_is_audited(): void
    {
        $user = $this->draft();

        $this->assertSame(UserStatus::DRAFT, $user->statusEnum());
        $this->assertDatabaseHas('audit_logs', ['action' => 'user.created', 'entity_type' => 'user', 'entity_id' => (string) $user->id]);
    }

    public function test_identity_is_deduplicated_by_email(): void
    {
        $this->draft('dupe@ecos.test');

        $this->expectException(\InvalidArgumentException::class);
        $this->draft('dupe@ecos.test');
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    public function test_valid_transition_activates_user(): void
    {
        $user = $this->draft();
        app(UserLifecycleService::class)->activate($user);

        $this->assertSame(UserStatus::ACTIVE, $user->refresh()->statusEnum());
        $this->assertNotNull($user->activated_at);
    }

    public function test_invalid_transition_is_rejected(): void
    {
        $user = $this->draft();
        app(UserLifecycleService::class)->activate($user);

        // active → pending_activation is not an allowed transition.
        $this->expectException(InvalidUserTransitionException::class);
        app(UserLifecycleService::class)->transition($user, UserStatus::PENDING_ACTIVATION);
    }

    public function test_soft_delete_transition_trashes_the_user(): void
    {
        $user = $this->draft();
        app(UserLifecycleService::class)->activate($user);
        app(UserLifecycleService::class)->softDelete($user);

        $this->assertSoftDeleted('users', ['id' => $user->id]);
        $this->assertSame(UserStatus::DELETED->value, $user->refresh()->status);
    }

    // ── Security rules ────────────────────────────────────────────────────────

    public function test_user_cannot_deactivate_own_account(): void
    {
        $actor = $this->draft('self@ecos.test');
        app(UserLifecycleService::class)->activate($actor);

        $this->expectException(UserSecurityRuleException::class);
        app(UserLifecycleService::class)->deactivate($actor->refresh(), $actor);
    }

    public function test_cannot_deactivate_the_last_super_admin(): void
    {
        $role = Role::create(['name' => 'Super Admin', 'slug' => 'super-admin', 'is_system' => true]);
        $admin = $this->draft('root@ecos.test');
        app(UserLifecycleService::class)->activate($admin);
        $admin->roles()->attach($role->id);

        $this->expectException(UserSecurityRuleException::class);
        app(UserLifecycleService::class)->suspend($admin->refresh());
    }

    public function test_can_deactivate_a_super_admin_when_another_active_one_exists(): void
    {
        $role = Role::create(['name' => 'Super Admin', 'slug' => 'super-admin', 'is_system' => true]);
        $a = $this->draft('a@ecos.test');
        $b = $this->draft('b@ecos.test');
        app(UserLifecycleService::class)->activate($a);
        app(UserLifecycleService::class)->activate($b);
        $a->roles()->attach($role->id);
        $b->roles()->attach($role->id);

        app(UserLifecycleService::class)->suspend($a->refresh());
        $this->assertSame(UserStatus::SUSPENDED, $a->refresh()->statusEnum());
    }

    // ── Invitation flow ───────────────────────────────────────────────────────

    public function test_invitation_then_activation_sets_password_and_activates(): void
    {
        $user = $this->draft('invitee@ecos.test');
        $service = app(UserInvitationService::class);

        $token = $service->invite($user);
        $this->assertSame(UserStatus::INVITED, $user->refresh()->statusEnum());
        $this->assertDatabaseHas('user_invitations', ['user_id' => $user->id, 'status' => UserInvitation::STATUS_PENDING]);
        // Raw token is never stored — only its hash.
        $this->assertDatabaseMissing('user_invitations', ['token_hash' => $token]);

        $activated = $service->activate($token, 'S3cure-Pass!');
        $this->assertSame(UserStatus::ACTIVE, $activated->statusEnum());
        $this->assertTrue(Hash::check('S3cure-Pass!', $activated->password));
        $this->assertDatabaseHas('user_invitations', ['user_id' => $user->id, 'status' => UserInvitation::STATUS_ACCEPTED]);
    }

    public function test_expired_or_invalid_token_cannot_activate(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        app(UserInvitationService::class)->activate('not-a-real-token', 'whatever');
    }

    // ── Organization assignment ───────────────────────────────────────────────

    public function test_organization_assignment_is_additive(): void
    {
        $user = $this->draft();
        $svc = app(UserOrganizationAssignmentService::class);

        $svc->assign($user, 'company', 'company-uuid-1', 'Acme', primary: true);
        $svc->assign($user, 'warehouse', 'wh-uuid-1', 'Main WH');

        $this->assertSame(2, $user->organizationAssignments()->count());
        $this->assertDatabaseHas('user_organization_assignments', ['user_id' => $user->id, 'org_type' => 'company', 'is_primary' => true]);
    }

    public function test_unknown_organization_type_is_rejected(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        app(UserOrganizationAssignmentService::class)->assign($this->draft(), 'planet', 'x');
    }

    // ── Role template assignment (integration with IAM-003) ───────────────────

    public function test_assigning_a_template_compiles_a_role_and_grants_permissions(): void
    {
        $user = $this->draft();
        $template = $this->customTemplate('rep', [
            'permissions' => ['sales.orders.view', 'sales.orders.create'],
            'scopes' => ['sales.orders' => 'self'],
        ]);

        app(UserRoleAssignmentService::class)->assignTemplate($user, $template, primary: true);

        // The template compiled into a runtime role, now linked and attached to the user.
        $this->assertNotNull($template->refresh()->role_id);
        $this->assertTrue($user->hasRole('tpl-rep'));
        // The Authorization Platform (unchanged) now sees the granted permission.
        $this->assertTrue(app(PermissionServiceInterface::class)->userHasPermission($user, 'sales.orders.view'));
        // Effective profile reflects the assignment.
        $profile = app(UserRoleAssignmentService::class)->effectiveProfile($user);
        $this->assertContains('sales.orders.view', $profile->permissions);
        $this->assertSame('self', $profile->scopeFor('sales.orders'));
        // Data scope was written onto role_permissions during compilation.
        $this->assertDatabaseHas('role_permissions', ['role_id' => $template->role_id, 'data_scope' => 'self']);
    }

    public function test_removing_a_template_detaches_the_role(): void
    {
        $user = $this->draft();
        $template = $this->customTemplate('viewer', ['permissions' => ['sales.orders.view']]);
        $roles = app(UserRoleAssignmentService::class);

        $roles->assignTemplate($user, $template);
        $this->assertTrue($user->hasRole('tpl-viewer'));

        $roles->removeTemplate($user, $template);
        $this->assertFalse($user->fresh()->hasRole('tpl-viewer'));
        $this->assertSame(0, UserTemplateAssignment::where('user_id', $user->id)->count());
    }

    public function test_effective_profile_composes_multiple_templates(): void
    {
        $user = $this->draft();
        $roles = app(UserRoleAssignmentService::class);
        $roles->assignTemplate($user, $this->customTemplate('primary', [
            'permissions' => ['sales.orders.view'],
            'scopes' => ['sales.orders' => 'self'],
        ]), primary: true);
        $roles->assignTemplate($user, $this->customTemplate('secondary', [
            'permissions' => ['inventory.products.view'],
            'scopes' => ['sales.orders' => 'team'],
        ]));

        $profile = $roles->effectiveProfile($user);

        $this->assertContains('sales.orders.view', $profile->permissions);
        $this->assertContains('inventory.products.view', $profile->permissions);
        // Widest scope wins across templates.
        $this->assertSame('team', $profile->scopeFor('sales.orders'));
    }

    // ── Sessions ──────────────────────────────────────────────────────────────

    public function test_force_logout_revokes_sessions_and_tokens(): void
    {
        $user = $this->draft();
        $token = $user->createToken('web');
        $sessions = app(UserSessionService::class);
        $sessions->record($user, $token->accessToken->getKey(), '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0) Chrome/120');

        $this->assertSame(1, $sessions->activeSessions($user)->count());

        $revoked = $sessions->forceLogout($user);
        $this->assertSame(1, $revoked);
        $this->assertSame(0, $sessions->activeSessions($user)->count());
        $this->assertSame(0, $user->tokens()->count());
    }
}
