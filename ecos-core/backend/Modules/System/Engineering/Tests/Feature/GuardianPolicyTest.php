<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Auth\Domain\Models\User;
use Modules\System\Engineering\Application\Services\GuardianPolicyService;
use Modules\System\Engineering\Domain\Models\GuardianPolicy;
use Tests\TestCase;

class GuardianPolicyTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create(['company_id' => \Str::uuid()]);
        $this->actingAs($this->user);
    }

    public function test_can_create_policy(): void
    {
        $res = $this->postJson('/api/system/engineering/guardian/policies', [
            'name'                => 'Strict',
            'block_on'            => ['security', 'safety'],
            'max_repair_attempts' => 3,
        ]);

        $res->assertStatus(201);
        $this->assertDatabaseHas('engineering_guardian_policies', [
            'company_id' => $this->user->company_id, 'name' => 'Strict',
        ]);
    }

    public function test_create_validates_block_on_values(): void
    {
        $this->postJson('/api/system/engineering/guardian/policies', [
            'name'     => 'Bad',
            'block_on' => ['bogus'],
        ])->assertStatus(422);
    }

    public function test_active_returns_builtin_default_when_none(): void
    {
        $res = $this->getJson('/api/system/engineering/guardian/policies/active');

        $res->assertOk()->assertJsonPath(
            'data.name',
            config('engineering.guardian.default_policy.name')
        );
    }

    public function test_active_returns_company_policy(): void
    {
        GuardianPolicy::create([
            'company_id' => $this->user->company_id,
            'name'       => 'Company Default',
            'is_active'  => true,
            'is_default' => true,
        ]);

        $this->getJson('/api/system/engineering/guardian/policies/active')
            ->assertOk()
            ->assertJsonPath('data.name', 'Company Default');
    }

    public function test_only_one_default(): void
    {
        $a = $this->postJson('/api/system/engineering/guardian/policies', [
            'name' => 'A', 'is_default' => true,
        ])->json('data.id');

        $this->postJson('/api/system/engineering/guardian/policies', [
            'name' => 'B', 'is_default' => true,
        ]);

        $this->assertDatabaseHas('engineering_guardian_policies', [
            'id' => $a, 'is_default' => false,
        ]);
    }

    public function test_update_policy(): void
    {
        $policy = GuardianPolicy::create([
            'company_id' => $this->user->company_id,
            'name'       => 'Editable',
            'is_active'  => true,
        ]);

        $this->patchJson("/api/system/engineering/guardian/policies/{$policy->id}", [
            'auto_repair' => false,
        ])->assertOk();

        $this->assertDatabaseHas('engineering_guardian_policies', [
            'id' => $policy->id, 'auto_repair' => false,
        ]);
    }

    public function test_deactivate_falls_back_to_builtin(): void
    {
        $policy = GuardianPolicy::create([
            'company_id' => $this->user->company_id,
            'name'       => 'Temp',
            'is_active'  => true,
            'is_default' => true,
        ]);

        $this->postJson("/api/system/engineering/guardian/policies/{$policy->id}/deactivate")
            ->assertOk();

        $this->getJson('/api/system/engineering/guardian/policies/active')
            ->assertJsonPath('data.name', config('engineering.guardian.default_policy.name'));
    }

    public function test_company_isolation(): void
    {
        $foreign = GuardianPolicy::create([
            'company_id' => \Str::uuid()->toString(),
            'name'       => 'Foreign',
            'is_active'  => true,
        ]);

        $this->patchJson("/api/system/engineering/guardian/policies/{$foreign->id}", [
            'name' => 'Hijacked',
        ])->assertNotFound();
    }

    public function test_policy_resolution_returns_unsaved_builtin(): void
    {
        $resolved = app(GuardianPolicyService::class)->resolveFor($this->user->company_id);

        $this->assertFalse($resolved->exists);
    }
}
