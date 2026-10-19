<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Auth\Domain\Models\User;
use Modules\System\Engineering\Domain\Models\EngineeringRelease;
use Modules\System\Engineering\Domain\Models\EngineeringReleaseApproval;
use Tests\TestCase;

class ReleaseApprovalTest extends TestCase
{
    use RefreshDatabase;
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create(['company_id' => \Str::uuid()]);
        $this->actingAs($this->user);
    }

    private function makeRelease(string $status = 'approval_pending'): EngineeringRelease
    {
        return EngineeringRelease::factory()->create([
            'company_id' => $this->user->company_id,
            'status'     => $status,
        ]);
    }

    public function test_can_initiate_approval_workflow(): void
    {
        $release = $this->makeRelease();
        $res     = $this->postJson("/api/system/engineering/releases/{$release->id}/approvals/initiate");
        $res->assertOk()->assertJsonStructure(['data' => ['approvals', 'count']]);
        $this->assertDatabaseHas('engineering_release_approvals', ['release_id' => $release->id, 'status' => 'pending']);
    }

    public function test_initiation_creates_4_approval_levels(): void
    {
        $release = $this->makeRelease();
        $this->postJson("/api/system/engineering/releases/{$release->id}/approvals/initiate");
        $this->assertDatabaseCount('engineering_release_approvals', 4);
    }

    public function test_can_get_approval_status(): void
    {
        $release = $this->makeRelease();
        $this->postJson("/api/system/engineering/releases/{$release->id}/approvals/initiate");
        $res = $this->getJson("/api/system/engineering/releases/{$release->id}/approvals/status");
        $res->assertOk()->assertJsonStructure(['data' => ['approvals', 'all_granted', 'pending_count', 'rejected_any']]);
    }

    public function test_can_approve_an_approval(): void
    {
        $release  = $this->makeRelease();
        $this->postJson("/api/system/engineering/releases/{$release->id}/approvals/initiate");
        $approval = EngineeringReleaseApproval::where('release_id', $release->id)->first();
        $res      = $this->postJson("/api/system/engineering/releases/{$release->id}/approvals/{$approval->id}/decide", [
            'decision' => 'approved',
            'comment'  => 'LGTM',
        ]);
        $res->assertOk();
        $this->assertDatabaseHas('engineering_release_approvals', ['id' => $approval->id, 'status' => 'approved']);
    }

    public function test_rejection_sets_release_to_rejected(): void
    {
        $release  = $this->makeRelease();
        $this->postJson("/api/system/engineering/releases/{$release->id}/approvals/initiate");
        $approval = EngineeringReleaseApproval::where('release_id', $release->id)->where('is_required', true)->first();
        $this->postJson("/api/system/engineering/releases/{$release->id}/approvals/{$approval->id}/decide", [
            'decision' => 'rejected',
            'comment'  => 'Not ready',
        ]);
        $this->assertDatabaseHas('engineering_releases', ['id' => $release->id, 'status' => 'rejected']);
    }

    public function test_can_skip_optional_approval(): void
    {
        $release  = $this->makeRelease();
        $this->postJson("/api/system/engineering/releases/{$release->id}/approvals/initiate");
        $approval = EngineeringReleaseApproval::where('release_id', $release->id)->first();
        $this->postJson("/api/system/engineering/releases/{$release->id}/approvals/{$approval->id}/skip", ['reason' => 'N/A'])->assertOk();
        $this->assertDatabaseHas('engineering_release_approvals', ['id' => $approval->id, 'status' => 'skipped']);
    }

    public function test_company_isolation_on_approval(): void
    {
        $other   = EngineeringRelease::factory()->create(['company_id' => \Str::uuid()]);
        $this->postJson("/api/system/engineering/releases/{$other->id}/approvals/initiate")->assertForbidden();
    }
}
