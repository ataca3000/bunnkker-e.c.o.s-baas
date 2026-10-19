<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Auth\Domain\Models\User;
use Modules\System\Engineering\Domain\Models\EngineeringRelease;
use Modules\System\Engineering\Domain\Models\EngineeringTask;
use Tests\TestCase;

class ReleaseTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create(['company_id' => \Str::uuid()]);
        $this->actingAs($this->user);
    }

    public function test_can_get_dashboard(): void
    {
        $res = $this->getJson('/api/system/engineering/releases/dashboard');
        $res->assertOk()->assertJsonStructure(['data' => ['summary', 'recent_releases', 'upcoming', 'readiness_avg']]);
    }

    public function test_can_list_releases(): void
    {
        EngineeringRelease::factory()->count(3)->create(['company_id' => $this->user->company_id]);
        $res = $this->getJson('/api/system/engineering/releases');
        $res->assertOk()->assertJsonStructure(['data' => ['data', 'meta']]);
        $this->assertCount(3, $res->json('data.data'));
    }

    public function test_can_create_release(): void
    {
        $res = $this->postJson('/api/system/engineering/releases', [
            'name'    => 'Release v1.0.0',
            'version' => '1.0.0',
        ]);
        $res->assertStatus(201)->assertJsonPath('data.release.name', 'Release v1.0.0');
        $this->assertDatabaseHas('engineering_releases', ['name' => 'Release v1.0.0', 'status' => 'draft']);
    }

    public function test_create_requires_name(): void
    {
        $this->postJson('/api/system/engineering/releases', [])->assertStatus(422);
    }

    public function test_can_get_release(): void
    {
        $release = EngineeringRelease::factory()->create(['company_id' => $this->user->company_id]);
        $res     = $this->getJson("/api/system/engineering/releases/{$release->id}");
        $res->assertOk()->assertJsonPath('data.release.id', $release->id);
    }

    public function test_cannot_access_other_company_release(): void
    {
        $other = EngineeringRelease::factory()->create(['company_id' => \Str::uuid()]);
        $this->getJson("/api/system/engineering/releases/{$other->id}")->assertForbidden();
    }

    public function test_can_transition_draft_to_collecting(): void
    {
        $release = EngineeringRelease::factory()->create(['company_id' => $this->user->company_id, 'status' => 'draft']);
        $res     = $this->postJson("/api/system/engineering/releases/{$release->id}/transition", ['status' => 'collecting']);
        $res->assertOk()->assertJsonPath('data.release.status', 'collecting');
    }

    public function test_invalid_transition_rejected(): void
    {
        $release = EngineeringRelease::factory()->create(['company_id' => $this->user->company_id, 'status' => 'draft']);
        $this->postJson("/api/system/engineering/releases/{$release->id}/transition", ['status' => 'released'])->assertStatus(500);
    }

    public function test_can_clone_release(): void
    {
        $release = EngineeringRelease::factory()->create(['company_id' => $this->user->company_id]);
        $res     = $this->postJson("/api/system/engineering/releases/{$release->id}/clone", ['name' => 'Release Clone']);
        $res->assertStatus(201)->assertJsonPath('data.release.name', 'Release Clone');
        $this->assertDatabaseHas('engineering_releases', ['cloned_from_id' => $release->id]);
    }

    public function test_can_add_and_remove_tasks(): void
    {
        $release = EngineeringRelease::factory()->create(['company_id' => $this->user->company_id, 'task_ids' => []]);
        $task    = EngineeringTask::factory()->create(['company_id' => $this->user->company_id]);
        $this->postJson("/api/system/engineering/releases/{$release->id}/tasks/add", ['task_ids' => [$task->id]])->assertOk();
        $fresh = $release->fresh();
        $this->assertContains($task->id, $fresh->task_ids);
        $this->postJson("/api/system/engineering/releases/{$release->id}/tasks/remove", ['task_ids' => [$task->id]])->assertOk();
        $fresh = $release->fresh();
        $this->assertNotContains($task->id, $fresh->task_ids);
    }

    public function test_validation_runs_all_checks(): void
    {
        $release = EngineeringRelease::factory()->create(['company_id' => $this->user->company_id]);
        $res     = $this->postJson("/api/system/engineering/releases/{$release->id}/validate");
        $res->assertOk()->assertJsonStructure(['data' => ['validation', 'readiness']]);
        $this->assertDatabaseHas('engineering_release_validation', ['release_id' => $release->id]);
    }

    public function test_readiness_score_returned(): void
    {
        $release = EngineeringRelease::factory()->create(['company_id' => $this->user->company_id]);
        $this->postJson("/api/system/engineering/releases/{$release->id}/validate");
        $res = $this->getJson("/api/system/engineering/releases/{$release->id}/readiness");
        $res->assertOk()->assertJsonStructure(['data' => ['overall', 'breakdown', 'checks']]);
    }

    public function test_risk_analysis_runs(): void
    {
        $release = EngineeringRelease::factory()->create(['company_id' => $this->user->company_id]);
        $res     = $this->postJson("/api/system/engineering/releases/{$release->id}/analyze-risks");
        $res->assertOk()->assertJsonStructure(['data' => ['risk_level', 'risk_count']]);
    }

    public function test_dependency_analysis_runs(): void
    {
        $release = EngineeringRelease::factory()->create(['company_id' => $this->user->company_id]);
        $res     = $this->postJson("/api/system/engineering/releases/{$release->id}/analyze-dependencies");
        $res->assertOk()->assertJsonStructure(['data' => ['summary']]);
    }

    public function test_reports_generated(): void
    {
        $release = EngineeringRelease::factory()->create(['company_id' => $this->user->company_id]);
        $res     = $this->postJson("/api/system/engineering/releases/{$release->id}/reports/generate");
        $res->assertOk()->assertJsonStructure(['data' => ['reports']]);
        $this->assertDatabaseHas('engineering_release_reports', ['release_id' => $release->id]);
    }

    public function test_audit_trail_created_on_create(): void
    {
        $this->postJson('/api/system/engineering/releases', ['name' => 'Audit Test Release']);
        $this->assertDatabaseHas('engineering_release_audit', ['event_type' => 'release_created']);
    }

    public function test_can_delete_draft_release(): void
    {
        $release = EngineeringRelease::factory()->create(['company_id' => $this->user->company_id, 'status' => 'draft']);
        $this->deleteJson("/api/system/engineering/releases/{$release->id}")->assertOk();
        $this->assertSoftDeleted('engineering_releases', ['id' => $release->id]);
    }

    public function test_company_isolation_on_list(): void
    {
        EngineeringRelease::factory()->count(2)->create(['company_id' => $this->user->company_id]);
        EngineeringRelease::factory()->count(3)->create(['company_id' => \Str::uuid()]);
        $res = $this->getJson('/api/system/engineering/releases');
        $this->assertCount(2, $res->json('data.data'));
    }
}
