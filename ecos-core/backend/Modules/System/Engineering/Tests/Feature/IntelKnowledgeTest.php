<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Auth\Domain\Models\User;
use Modules\System\Engineering\Application\Services\IntelConfidenceScorer;
use Modules\System\Engineering\Domain\Models\IntelKnowledgeEntry;
use Modules\System\Engineering\Domain\Models\RepairSession;
use Tests\TestCase;

class IntelKnowledgeTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create(['company_id' => \Str::uuid()]);
        $this->actingAs($this->user);
    }

    private function makeSession(string $status, string $failureType = 'test_failure', ?string $rootCause = 'assertion_failure'): RepairSession
    {
        return RepairSession::create([
            'company_id'          => $this->user->company_id,
            'source_type'         => 'manual',
            'status'              => $status,
            'failure_type'        => $failureType,
            'failure_summary'     => 'seed session',
            'root_cause_category' => $rootCause,
            'retry_count'         => 0,
            'max_retries'         => 3,
            'timeout_seconds'     => 300,
        ]);
    }

    public function test_learn_builds_knowledge_from_repairs(): void
    {
        $this->makeSession('completed');
        $this->makeSession('completed');
        $this->makeSession('failed');

        $res = $this->postJson('/api/system/engineering/intelligence/knowledge/learn');
        $res->assertStatus(201);

        $this->assertDatabaseHas('engineering_intel_knowledge', [
            'company_id'    => $this->user->company_id,
            'category'      => 'repair',
            'failure_type'  => 'test_failure',
            'root_cause'    => 'assertion_failure',
            'occurrences'   => 3,
            'success_count' => 2,
            'failure_count' => 1,
        ]);
    }

    public function test_learning_is_reproducible(): void
    {
        $this->makeSession('completed');
        $this->makeSession('failed');

        $this->postJson('/api/system/engineering/intelligence/knowledge/learn');
        $first = IntelKnowledgeEntry::where('company_id', $this->user->company_id)
            ->get(['category', 'failure_type', 'root_cause', 'occurrences', 'success_count', 'failure_count', 'confidence'])
            ->toArray();

        // Second run over unchanged data must converge on identical rows.
        $this->postJson('/api/system/engineering/intelligence/knowledge/learn');
        $second = IntelKnowledgeEntry::where('company_id', $this->user->company_id)
            ->get(['category', 'failure_type', 'root_cause', 'occurrences', 'success_count', 'failure_count', 'confidence'])
            ->toArray();

        $this->assertSame($first, $second);
    }

    public function test_recommendations_ranked_by_confidence(): void
    {
        foreach (range(1, 5) as $i) {
            $this->makeSession('completed', 'build_failure', 'syntax_error');
        }
        $this->makeSession('failed', 'build_failure', 'missing_dependency');

        $this->postJson('/api/system/engineering/intelligence/knowledge/learn');

        $res = $this->getJson('/api/system/engineering/intelligence/knowledge/recommendations?failure_type=build_failure');
        $res->assertOk();

        $recommendations = $res->json('data');
        $this->assertNotEmpty($recommendations);
        $this->assertSame('syntax_error', $recommendations[0]['root_cause']);
    }

    public function test_confidence_neutral_without_history(): void
    {
        $res = $this->getJson('/api/system/engineering/intelligence/knowledge/confidence?failure_type=build_failure');

        $res->assertOk()->assertJsonPath('data.repair_confidence', 50);
    }

    public function test_confidence_scales_with_success_history(): void
    {
        foreach (range(1, 5) as $i) {
            $this->makeSession('completed', 'build_failure', 'syntax_error');
        }
        $this->postJson('/api/system/engineering/intelligence/knowledge/learn');

        $confidence = app(IntelConfidenceScorer::class)
            ->repairConfidence($this->user->company_id, 'build_failure', 'syntax_error');

        $this->assertSame(100.0, $confidence);
    }

    public function test_patterns_require_recurrence(): void
    {
        $this->makeSession('failed', 'build_failure', 'syntax_error');

        $res = $this->getJson('/api/system/engineering/intelligence/knowledge/patterns');
        $res->assertOk();
        $this->assertSame([], $res->json('data.recurring_problems'));

        $this->makeSession('failed', 'build_failure', 'syntax_error');

        $res = $this->getJson('/api/system/engineering/intelligence/knowledge/patterns');
        $problems = $res->json('data.recurring_problems');
        $this->assertCount(1, $problems);
        $this->assertSame(2, $problems[0]['occurrences']);
    }

    public function test_company_isolation_on_knowledge(): void
    {
        $this->makeSession('completed');
        $this->postJson('/api/system/engineering/intelligence/knowledge/learn');

        $other = User::factory()->create(['company_id' => \Str::uuid()]);
        $this->actingAs($other);

        $res = $this->getJson('/api/system/engineering/intelligence/knowledge');
        $res->assertOk();
        $this->assertCount(0, $res->json('data'));
    }
}
