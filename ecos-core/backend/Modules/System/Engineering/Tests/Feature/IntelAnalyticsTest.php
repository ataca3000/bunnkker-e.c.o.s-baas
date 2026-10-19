<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Auth\Domain\Models\User;
use Modules\System\Engineering\Domain\Models\GuardianRun;
use Modules\System\Engineering\Domain\Models\RepairSession;
use Tests\TestCase;

class IntelAnalyticsTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create(['company_id' => \Str::uuid()]);
        $this->actingAs($this->user);
    }

    private function makeSession(string $status): RepairSession
    {
        return RepairSession::create([
            'company_id'      => $this->user->company_id,
            'source_type'     => 'manual',
            'status'          => $status,
            'failure_type'    => 'test_failure',
            'failure_summary' => 'seed',
            'retry_count'     => 0,
            'max_retries'     => 3,
            'timeout_seconds' => 300,
        ]);
    }

    public function test_overview_computes_success_rates(): void
    {
        $this->makeSession('completed');
        $this->makeSession('completed');
        $this->makeSession('failed');

        $res = $this->getJson('/api/system/engineering/intelligence/analytics/overview');

        $res->assertOk()
            ->assertJsonPath('data.repairs.total', 3)
            ->assertJsonPath('data.repairs.completed', 2)
            ->assertJsonPath('data.repairs.success_rate', 66.67);
    }

    public function test_overview_is_deterministic(): void
    {
        $this->makeSession('completed');
        $this->makeSession('failed');

        $first  = $this->getJson('/api/system/engineering/intelligence/analytics/overview')->json('data');
        $second = $this->getJson('/api/system/engineering/intelligence/analytics/overview')->json('data');

        $this->assertSame($first, $second);
    }

    public function test_debt_analysis_returns_breakdown(): void
    {
        $res = $this->getJson('/api/system/engineering/intelligence/analytics/debt');

        $res->assertOk()->assertJsonStructure(['data' => ['debt_score', 'debt_level', 'breakdown']]);
        $this->assertSame(0, (int) $res->json('data.debt_score'));
        $this->assertSame('low', $res->json('data.debt_level'));
    }

    public function test_debt_rises_with_exhausted_failures(): void
    {
        RepairSession::create([
            'company_id'      => $this->user->company_id,
            'source_type'     => 'manual',
            'status'          => 'failed',
            'failure_type'    => 'test_failure',
            'failure_summary' => 'exhausted',
            'retry_count'     => 3,
            'max_retries'     => 3,
            'timeout_seconds' => 300,
        ]);

        $res = $this->getJson('/api/system/engineering/intelligence/analytics/debt');
        $this->assertGreaterThan(0, $res->json('data.debt_score'));
    }

    public function test_trends_endpoint_returns_series_and_directions(): void
    {
        $this->makeSession('completed');

        $res = $this->getJson('/api/system/engineering/intelligence/analytics/trends');

        $res->assertOk()->assertJsonStructure(['data' => [
            'series' => ['repair_success_rate', 'validation_accept_rate', 'guardian_allow_rate'],
            'directions',
        ]]);
    }

    public function test_period_comparison_returns_deltas(): void
    {
        $this->makeSession('completed');

        $res = $this->getJson('/api/system/engineering/intelligence/analytics/compare-periods?days=7');

        $res->assertOk()->assertJsonStructure(['data' => [
            'current', 'previous',
            'deltas' => ['repair_success_rate', 'validation_accept_rate', 'guardian_allow_rate'],
        ]]);
    }

    public function test_snapshot_freezes_metrics(): void
    {
        $this->makeSession('completed');

        $this->postJson('/api/system/engineering/intelligence/analytics/snapshots', [
            'snapshot_type' => 'daily',
            'period_label'  => '2026-07-23',
        ])->assertStatus(201);

        $this->assertDatabaseHas('engineering_intel_snapshots', [
            'company_id'    => $this->user->company_id,
            'snapshot_type' => 'daily',
            'period_label'  => '2026-07-23',
        ]);

        $res = $this->getJson('/api/system/engineering/intelligence/analytics/snapshots?snapshot_type=daily');
        $this->assertCount(1, $res->json('data'));
    }

    public function test_predictions_ranked_by_risk(): void
    {
        foreach (range(1, 4) as $i) {
            $this->makeSession('failed');
        }
        RepairSession::create([
            'company_id'      => $this->user->company_id,
            'source_type'     => 'manual',
            'status'          => 'completed',
            'failure_type'    => 'documentation_gap',
            'failure_summary' => 'benign',
            'retry_count'     => 0,
            'max_retries'     => 2,
            'timeout_seconds' => 300,
        ]);

        $res = $this->getJson('/api/system/engineering/intelligence/predictions');

        $res->assertOk();
        $predictions = $res->json('data');
        $this->assertNotEmpty($predictions);
        $this->assertSame('test_failure', $predictions[0]['failure_type']);
        $this->assertGreaterThan($predictions[1]['risk_score'] ?? 0, $predictions[0]['risk_score']);
    }

    public function test_insights_generation_and_acknowledge(): void
    {
        $res = $this->postJson('/api/system/engineering/intelligence/insights/generate');
        $res->assertStatus(201);

        // Seed a failing week to trigger at least an insight-capable state,
        // then verify the acknowledge flow with a manually created row.
        $insight = \Modules\System\Engineering\Domain\Models\IntelInsight::create([
            'company_id'   => $this->user->company_id,
            'insight_type' => 'manual_seed',
            'severity'     => 'warning',
            'title'        => 'Seed insight',
            'description'  => 'Seeded for acknowledge test',
            'generated_at' => now(),
        ]);

        $this->postJson("/api/system/engineering/intelligence/insights/{$insight->id}/acknowledge")
            ->assertOk()
            ->assertJsonPath('data.is_acknowledged', true);

        // Acknowledged insights survive regeneration.
        $this->postJson('/api/system/engineering/intelligence/insights/generate');
        $this->assertDatabaseHas('engineering_intel_insights', [
            'id' => $insight->id, 'is_acknowledged' => true,
        ]);
    }

    public function test_guardian_rates_feed_overview(): void
    {
        GuardianRun::create([
            'company_id'     => $this->user->company_id,
            'trigger_source' => 'manual',
            'status'         => 'passed',
            'decision'       => 'allow',
            'changed_files'  => ['a.php'],
        ]);

        $res = $this->getJson('/api/system/engineering/intelligence/analytics/overview');
        $res->assertOk()->assertJsonPath('data.guardian.allowed', 1);
    }

    public function test_company_isolation_on_analytics(): void
    {
        $this->makeSession('completed');

        $other = User::factory()->create(['company_id' => \Str::uuid()]);
        $this->actingAs($other);

        $res = $this->getJson('/api/system/engineering/intelligence/analytics/overview');
        $res->assertOk()->assertJsonPath('data.repairs.total', 0);
    }
}
