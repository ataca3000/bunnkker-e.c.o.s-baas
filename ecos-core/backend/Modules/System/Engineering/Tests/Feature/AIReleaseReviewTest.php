<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Auth\Domain\Models\User;
use Modules\System\Engineering\Domain\Models\EngineeringAIReview;
use Modules\System\Engineering\Domain\Models\EngineeringAIReleaseReview;
use Modules\System\Engineering\Domain\Models\EngineeringRelease;
use Tests\TestCase;

class AIReleaseReviewTest extends TestCase
{
    use RefreshDatabase;
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create(['company_id' => \Str::uuid()]);
        $this->actingAs($this->user);
    }

    public function test_can_trigger_release_ai_review(): void
    {
        $release = EngineeringRelease::factory()->create(['company_id' => $this->user->company_id]);
        $res     = $this->postJson("/api/system/engineering/releases/{$release->id}/ai-review");
        $res->assertStatus(201)->assertJsonStructure(['data' => ['review', 'release_review']]);
        $this->assertDatabaseHas('engineering_ai_release_reviews', ['release_id' => $release->id]);
    }

    public function test_trigger_runs_full_review(): void
    {
        $release = EngineeringRelease::factory()->create(['company_id' => $this->user->company_id]);
        $res     = $this->postJson("/api/system/engineering/releases/{$release->id}/ai-review");
        $this->assertEquals('completed', $res->json('data.review.status'));
        $this->assertNotNull($res->json('data.review.overall_score'));
    }

    public function test_release_review_has_recommendation(): void
    {
        $release = EngineeringRelease::factory()->create(['company_id' => $this->user->company_id]);
        $res     = $this->postJson("/api/system/engineering/releases/{$release->id}/ai-review");
        $this->assertNotNull($res->json('data.release_review.recommendation'));
    }

    public function test_can_get_release_review(): void
    {
        $release  = EngineeringRelease::factory()->create(['company_id' => $this->user->company_id]);
        $review   = EngineeringAIReview::factory()->create(['company_id' => $this->user->company_id, 'status' => 'completed']);
        EngineeringAIReleaseReview::factory()->create(['company_id' => $this->user->company_id, 'review_id' => $review->id, 'release_id' => $release->id]);
        $res = $this->getJson("/api/system/engineering/releases/{$release->id}/ai-review");
        $res->assertOk()->assertJsonStructure(['data' => ['release_review']]);
    }

    public function test_no_review_returns_null(): void
    {
        $release = EngineeringRelease::factory()->create(['company_id' => $this->user->company_id]);
        $res     = $this->getJson("/api/system/engineering/releases/{$release->id}/ai-review/recommendation");
        $res->assertOk()->assertJsonPath('data.recommendation', null);
    }

    public function test_company_isolation_on_trigger(): void
    {
        $other = EngineeringRelease::factory()->create(['company_id' => \Str::uuid()]);
        $this->postJson("/api/system/engineering/releases/{$other->id}/ai-review")->assertForbidden();
    }
}
