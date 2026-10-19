<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Auth\Domain\Models\User;
use Modules\System\Engineering\Domain\Models\GuardianDecisionLog;
use Modules\System\Engineering\Domain\Models\GuardianRun;
use Modules\System\Engineering\Domain\Models\RepairHistory;
use Modules\System\Engineering\Domain\Models\RepairSession;
use Tests\TestCase;

class WorkspaceTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create(['company_id' => \Str::uuid()]);
        $this->actingAs($this->user);
    }

    private function makeSession(string $status = 'pending', string $summary = 'workspace seed'): RepairSession
    {
        return RepairSession::create([
            'company_id'      => $this->user->company_id,
            'source_type'     => 'manual',
            'status'          => $status,
            'failure_type'    => 'test_failure',
            'failure_summary' => $summary,
            'retry_count'     => 0,
            'max_retries'     => 3,
            'timeout_seconds' => 300,
        ]);
    }

    public function test_executive_dashboard_composes_all_layers(): void
    {
        $this->makeSession('completed');

        $res = $this->getJson('/api/system/engineering/workspace/executive');

        $res->assertOk()->assertJsonStructure(['data' => [
            'health' => ['repair_success_rate', 'validation_accept_rate', 'guardian_allow_rate', 'debt_score', 'debt_level'],
            'repairs', 'guardian', 'validations', 'releases', 'insights', 'debt',
        ]]);
    }

    public function test_live_monitor_lists_in_flight_work(): void
    {
        $this->makeSession('analyzing');
        $this->makeSession('completed');

        $res = $this->getJson('/api/system/engineering/workspace/live');

        $res->assertOk();
        $this->assertCount(1, $res->json('data.active_repairs'));
    }

    public function test_timeline_merges_sources_in_order(): void
    {
        $session = $this->makeSession();

        RepairHistory::create([
            'session_id'  => $session->id,
            'company_id'  => $this->user->company_id,
            'event_type'  => 'session.created',
            'occurred_at' => now()->subMinutes(10),
        ]);

        $run = GuardianRun::create([
            'company_id'     => $this->user->company_id,
            'trigger_source' => 'manual',
            'status'         => 'passed',
            'decision'       => 'allow',
            'changed_files'  => ['a.php'],
        ]);

        GuardianDecisionLog::create([
            'run_id'      => $run->id,
            'company_id'  => $this->user->company_id,
            'decision'    => 'allow',
            'reason'      => 'clean',
            'decided_by'  => 'system',
            'occurred_at' => now()->subMinutes(2),
        ]);

        $res = $this->getJson('/api/system/engineering/workspace/timeline');

        $res->assertOk();
        $events = $res->json('data.events');
        $this->assertCount(2, $events);
        $this->assertSame('guardian', $events[0]['source']);
        $this->assertSame('repair', $events[1]['source']);
    }

    public function test_timeline_filters_by_type(): void
    {
        $session = $this->makeSession();
        RepairHistory::create([
            'session_id'  => $session->id,
            'company_id'  => $this->user->company_id,
            'event_type'  => 'session.created',
            'occurred_at' => now(),
        ]);

        $res = $this->getJson('/api/system/engineering/workspace/timeline?type=guardian');
        $res->assertOk();
        $this->assertCount(0, $res->json('data.events'));

        $this->getJson('/api/system/engineering/workspace/timeline?type=bogus')->assertStatus(422);
    }

    public function test_search_finds_entities(): void
    {
        $this->makeSession('pending', 'unique-needle-summary');

        $res = $this->getJson('/api/system/engineering/workspace/search?q=unique-needle');

        $res->assertOk();
        $this->assertCount(1, $res->json('data.repair_sessions'));
        $this->assertSame([], $res->json('data.releases'));
    }

    public function test_search_requires_min_length(): void
    {
        $this->getJson('/api/system/engineering/workspace/search?q=a')->assertStatus(422);
    }

    public function test_export_returns_csv(): void
    {
        $this->makeSession('completed');

        $res = $this->get('/api/system/engineering/workspace/export?dataset=repair_sessions');

        $res->assertOk();
        $this->assertStringContainsString('text/csv', (string) $res->headers->get('Content-Type'));
        $this->assertStringStartsWith('id,status,failure_type', $res->getContent());
    }

    public function test_export_rejects_unknown_dataset(): void
    {
        $this->getJson('/api/system/engineering/workspace/export?dataset=users')->assertStatus(422);
    }

    public function test_saved_views_crud_and_sharing(): void
    {
        $created = $this->postJson('/api/system/engineering/workspace/views', [
            'name'    => 'My blocked runs',
            'context' => 'guardian',
            'filters' => ['decision' => 'block'],
        ]);
        $created->assertStatus(201);
        $viewId = $created->json('data.id');

        $this->patchJson("/api/system/engineering/workspace/views/{$viewId}", ['is_shared' => true])
            ->assertOk()
            ->assertJsonPath('data.is_shared', true);

        // A teammate in the same company sees shared views but cannot edit them.
        $teammate = User::factory()->create(['company_id' => $this->user->company_id]);
        $this->actingAs($teammate);

        $list = $this->getJson('/api/system/engineering/workspace/views');
        $this->assertCount(1, $list->json('data'));
        $this->patchJson("/api/system/engineering/workspace/views/{$viewId}", ['name' => 'hijack'])
            ->assertNotFound();
    }

    public function test_company_isolation_on_workspace(): void
    {
        $this->makeSession('completed', 'company-a-session');

        $other = User::factory()->create(['company_id' => \Str::uuid()]);
        $this->actingAs($other);

        $res = $this->getJson('/api/system/engineering/workspace/search?q=company-a');
        $res->assertOk();
        $this->assertCount(0, $res->json('data.repair_sessions'));

        $timeline = $this->getJson('/api/system/engineering/workspace/timeline');
        $this->assertCount(0, $timeline->json('data.events'));
    }
}
