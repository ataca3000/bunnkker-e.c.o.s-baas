<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Auth\Domain\Models\User;
use Modules\System\Engineering\Domain\Models\EngineeringRelease;
use Modules\System\Engineering\Domain\Models\EngineeringReleasePipelineRun;
use Tests\TestCase;

class ReleasePipelineTest extends TestCase
{
    use RefreshDatabase;
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create(['company_id' => \Str::uuid()]);
        $this->actingAs($this->user);
    }

    public function test_can_build_package(): void
    {
        $release = EngineeringRelease::factory()->create(['company_id' => $this->user->company_id, 'status' => 'queued']);
        $res     = $this->postJson("/api/system/engineering/releases/{$release->id}/pipeline/build");
        $res->assertOk()->assertJsonStructure(['data' => ['package']]);
        $this->assertDatabaseHas('engineering_release_packages', ['release_id' => $release->id]);
    }

    public function test_can_trigger_pipeline(): void
    {
        $release = EngineeringRelease::factory()->create(['company_id' => $this->user->company_id, 'status' => 'queued']);
        $res     = $this->postJson("/api/system/engineering/releases/{$release->id}/pipeline/trigger");
        $res->assertStatus(201)->assertJsonStructure(['data' => ['run']]);
        $this->assertDatabaseHas('engineering_release_pipeline_runs', ['release_id' => $release->id]);
        $this->assertDatabaseHas('engineering_releases', ['id' => $release->id, 'status' => 'pipeline_running']);
    }

    public function test_can_capture_success_result(): void
    {
        $release = EngineeringRelease::factory()->create(['company_id' => $this->user->company_id, 'status' => 'pipeline_running']);
        $run     = EngineeringReleasePipelineRun::factory()->create([
            'company_id' => $this->user->company_id,
            'release_id' => $release->id,
            'status'     => 'running',
        ]);
        $res = $this->postJson("/api/system/engineering/releases/{$release->id}/pipeline/{$run->id}/result", [
            'status'    => 'success',
            'logs'      => 'Pipeline completed successfully.',
            'exit_code' => 0,
        ]);
        $res->assertOk();
        $this->assertDatabaseHas('engineering_releases', ['id' => $release->id, 'status' => 'released']);
    }

    public function test_capture_failure_sets_pipeline_failed(): void
    {
        $release = EngineeringRelease::factory()->create(['company_id' => $this->user->company_id, 'status' => 'pipeline_running']);
        $run     = EngineeringReleasePipelineRun::factory()->create([
            'company_id' => $this->user->company_id,
            'release_id' => $release->id,
            'status'     => 'running',
        ]);
        $this->postJson("/api/system/engineering/releases/{$release->id}/pipeline/{$run->id}/result", [
            'status'    => 'failed',
            'logs'      => 'Step 3 failed.',
            'exit_code' => 1,
        ])->assertOk();
        $this->assertDatabaseHas('engineering_releases', ['id' => $release->id, 'status' => 'pipeline_failed']);
    }

    public function test_can_view_pipeline_history(): void
    {
        $release = EngineeringRelease::factory()->create(['company_id' => $this->user->company_id]);
        EngineeringReleasePipelineRun::factory()->count(2)->create(['company_id' => $this->user->company_id, 'release_id' => $release->id]);
        $res = $this->getJson("/api/system/engineering/releases/{$release->id}/pipeline/history");
        $res->assertOk()->assertJsonStructure(['data' => ['runs']]);
        $this->assertCount(2, $res->json('data.runs'));
    }

    public function test_company_isolation_on_pipeline(): void
    {
        $other = EngineeringRelease::factory()->create(['company_id' => \Str::uuid()]);
        $this->postJson("/api/system/engineering/releases/{$other->id}/pipeline/trigger")->assertForbidden();
    }
}
