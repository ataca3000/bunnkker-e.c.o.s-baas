<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Auth\Domain\Models\User;
use Modules\System\Engineering\Domain\Models\EngineeringAIReview;
use Modules\System\Engineering\Domain\Models\EngineeringAIRisk;
use Modules\System\Engineering\Domain\Models\EngineeringAIRecommendation;
use Tests\TestCase;

class AIReviewTest extends TestCase
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
        $res = $this->getJson('/api/system/engineering/ai-supervisor/dashboard');
        $res->assertOk()->assertJsonStructure(['data' => [
            'overall_score', 'recommendation', 'review_count_total',
            'review_count_this_month', 'architecture_compliance_rate', 'security_pass_rate',
            'recent_reviews', 'trend_30d', 'critical_risks', 'open_recommendations',
        ]]);
    }

    public function test_can_list_reviews(): void
    {
        EngineeringAIReview::factory()->count(3)->create(['company_id' => $this->user->company_id]);
        $res = $this->getJson('/api/system/engineering/ai-reviews');
        $res->assertOk()->assertJsonStructure(['data' => ['data', 'meta']]);
        $this->assertCount(3, $res->json('data.data'));
    }

    public function test_can_create_review(): void
    {
        $res = $this->postJson('/api/system/engineering/ai-reviews', ['review_type' => 'manual']);
        $res->assertStatus(201)->assertJsonPath('data.review.status', 'pending');
        $this->assertDatabaseHas('engineering_ai_reviews', ['company_id' => $this->user->company_id, 'review_type' => 'manual']);
    }

    public function test_can_get_review(): void
    {
        $review = EngineeringAIReview::factory()->create(['company_id' => $this->user->company_id]);
        $res    = $this->getJson("/api/system/engineering/ai-reviews/{$review->id}");
        $res->assertOk()->assertJsonPath('data.review.id', $review->id);
    }

    public function test_company_isolation_on_show(): void
    {
        $other = EngineeringAIReview::factory()->create(['company_id' => \Str::uuid()]);
        $this->getJson("/api/system/engineering/ai-reviews/{$other->id}")->assertForbidden();
    }

    public function test_can_run_review(): void
    {
        $review = EngineeringAIReview::factory()->create(['company_id' => $this->user->company_id, 'status' => 'pending']);
        $res    = $this->postJson("/api/system/engineering/ai-reviews/{$review->id}/run");
        $res->assertOk()->assertJsonPath('data.review.status', 'completed');
        $this->assertDatabaseHas('engineering_ai_reviews', ['id' => $review->id, 'status' => 'completed']);
    }

    public function test_run_creates_scores_for_all_9_dimensions(): void
    {
        $review = EngineeringAIReview::factory()->create(['company_id' => $this->user->company_id, 'status' => 'pending']);
        $this->postJson("/api/system/engineering/ai-reviews/{$review->id}/run");
        $this->assertDatabaseCount('engineering_ai_scores', 9);
    }

    public function test_run_creates_architecture_checks(): void
    {
        $review = EngineeringAIReview::factory()->create(['company_id' => $this->user->company_id, 'status' => 'pending']);
        $this->postJson("/api/system/engineering/ai-reviews/{$review->id}/run");
        $this->assertDatabaseHas('engineering_ai_architecture_checks', ['review_id' => $review->id]);
    }

    public function test_run_creates_security_checks(): void
    {
        $review = EngineeringAIReview::factory()->create(['company_id' => $this->user->company_id, 'status' => 'pending']);
        $this->postJson("/api/system/engineering/ai-reviews/{$review->id}/run");
        $this->assertDatabaseHas('engineering_ai_security_checks', ['review_id' => $review->id]);
    }

    public function test_run_sets_overall_score(): void
    {
        $review = EngineeringAIReview::factory()->create(['company_id' => $this->user->company_id, 'status' => 'pending']);
        $res    = $this->postJson("/api/system/engineering/ai-reviews/{$review->id}/run");
        $this->assertNotNull($res->json('data.review.overall_score'));
    }

    public function test_run_sets_recommendation(): void
    {
        $review = EngineeringAIReview::factory()->create(['company_id' => $this->user->company_id, 'status' => 'pending']);
        $res    = $this->postJson("/api/system/engineering/ai-reviews/{$review->id}/run");
        $this->assertNotNull($res->json('data.review.recommendation'));
        $this->assertContains($res->json('data.review.recommendation'), [
            'approve', 'approve_with_warnings', 'needs_review', 'reject', 'critical_block'
        ]);
    }

    public function test_can_cancel_review(): void
    {
        $review = EngineeringAIReview::factory()->create(['company_id' => $this->user->company_id, 'status' => 'pending']);
        $this->postJson("/api/system/engineering/ai-reviews/{$review->id}/cancel")->assertOk();
        $this->assertDatabaseHas('engineering_ai_reviews', ['id' => $review->id, 'status' => 'cancelled']);
    }

    public function test_can_get_scores_for_review(): void
    {
        $review = EngineeringAIReview::factory()->create(['company_id' => $this->user->company_id]);
        $this->postJson("/api/system/engineering/ai-reviews/{$review->id}/run");
        $res = $this->getJson("/api/system/engineering/ai-reviews/{$review->id}/scores");
        $res->assertOk()->assertJsonStructure(['data' => ['scores']]);
        $this->assertCount(9, $res->json('data.scores'));
    }

    public function test_can_acknowledge_risk(): void
    {
        $review = EngineeringAIReview::factory()->create(['company_id' => $this->user->company_id]);
        $risk   = EngineeringAIRisk::factory()->create(['review_id' => $review->id, 'company_id' => $this->user->company_id, 'is_acknowledged' => false]);
        $this->postJson("/api/system/engineering/ai-reviews/{$review->id}/risks/{$risk->id}/acknowledge")->assertOk();
        $this->assertDatabaseHas('engineering_ai_risks', ['id' => $risk->id, 'is_acknowledged' => true]);
    }

    public function test_can_resolve_recommendation(): void
    {
        $review = EngineeringAIReview::factory()->create(['company_id' => $this->user->company_id]);
        $rec    = EngineeringAIRecommendation::factory()->create(['review_id' => $review->id, 'company_id' => $this->user->company_id, 'is_resolved' => false]);
        $this->postJson("/api/system/engineering/ai-reviews/{$review->id}/recommendations/{$rec->id}/resolve")->assertOk();
        $this->assertDatabaseHas('engineering_ai_recommendations', ['id' => $rec->id, 'is_resolved' => true]);
    }

    public function test_run_records_history(): void
    {
        $review = EngineeringAIReview::factory()->create(['company_id' => $this->user->company_id, 'status' => 'pending']);
        $this->postJson("/api/system/engineering/ai-reviews/{$review->id}/run");
        $this->assertDatabaseHas('engineering_ai_history', ['review_id' => $review->id]);
    }

    public function test_run_records_trend(): void
    {
        $review = EngineeringAIReview::factory()->create(['company_id' => $this->user->company_id, 'status' => 'pending']);
        $this->postJson("/api/system/engineering/ai-reviews/{$review->id}/run");
        $this->assertDatabaseHas('engineering_ai_trends', ['company_id' => $this->user->company_id, 'period_type' => 'daily']);
    }

    public function test_company_isolation_on_list(): void
    {
        EngineeringAIReview::factory()->count(2)->create(['company_id' => $this->user->company_id]);
        EngineeringAIReview::factory()->count(3)->create(['company_id' => \Str::uuid()]);
        $res = $this->getJson('/api/system/engineering/ai-reviews');
        $this->assertCount(2, $res->json('data.data'));
    }

    public function test_soft_delete_review(): void
    {
        $review = EngineeringAIReview::factory()->create(['company_id' => $this->user->company_id]);
        $this->deleteJson("/api/system/engineering/ai-reviews/{$review->id}")->assertOk();
        $this->assertSoftDeleted('engineering_ai_reviews', ['id' => $review->id]);
    }
}
