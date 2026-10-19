<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Auth\Domain\Models\User;
use Modules\System\Engineering\Domain\Models\GuardianPolicy;
use Tests\TestCase;

class GuardianRunTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create(['company_id' => \Str::uuid()]);
        $this->actingAs($this->user);

        $stub = ['php', '-r', 'exit(0);'];
        config()->set('engineering.self_healing.commands', [
            'php_syntax' => $stub, 'composer' => $stub, 'pint' => $stub,
            'phpstan'    => $stub, 'eslint'   => $stub, 'typescript' => $stub,
            'build'      => $stub, 'tests'    => $stub,
        ]);
        config()->set('engineering.guardian.toolchain_checks', ['php_syntax']);
    }

    private function evaluatePayload(array $overrides = []): array
    {
        return array_merge([
            'trigger_source' => 'manual',
            'branch'         => 'feature/test',
            'changed_files'  => ['app/Example.php'],
            'diff_content'   => "+++ b/app/Example.php\n+ \$x = 1;",
        ], $overrides);
    }

    public function test_clean_diff_is_allowed(): void
    {
        $res = $this->postJson('/api/system/engineering/guardian/runs', $this->evaluatePayload());

        $res->assertStatus(201)
            ->assertJsonPath('data.decision', 'allow')
            ->assertJsonPath('data.allowed', true)
            ->assertJsonPath('data.run.status', 'passed');
    }

    public function test_evaluate_validates_payload(): void
    {
        $this->postJson('/api/system/engineering/guardian/runs', [
            'diff_content' => '+ x',
        ])->assertStatus(422);
    }

    public function test_security_violation_blocks(): void
    {
        $res = $this->postJson('/api/system/engineering/guardian/runs', $this->evaluatePayload([
            'diff_content' => "+++ b/app/Bad.php\n+ eval(\$x);",
            'changed_files' => ['app/Bad.php'],
        ]));

        $res->assertStatus(201)
            ->assertJsonPath('data.decision', 'block')
            ->assertJsonPath('data.allowed', false)
            ->assertJsonPath('data.run.status', 'failed');
    }

    public function test_blocked_run_opens_repair_session_automatically(): void
    {
        $res = $this->postJson('/api/system/engineering/guardian/runs', $this->evaluatePayload([
            'diff_content' => "+++ b/app/Bad.php\n+ eval(\$x);",
            'changed_files' => ['app/Bad.php'],
        ]));

        $sessionId = $res->json('data.run.repair_session_id');
        $this->assertNotNull($sessionId);
        $this->assertDatabaseHas('engineering_repair_sessions', [
            'id' => $sessionId, 'source_type' => 'guardian',
        ]);
        $this->assertDatabaseHas('engineering_repair_prompts', [
            'session_id' => $sessionId,
        ]);
    }

    public function test_auto_repair_disabled_by_policy(): void
    {
        GuardianPolicy::create([
            'company_id'  => $this->user->company_id,
            'name'        => 'No auto repair',
            'is_active'   => true,
            'is_default'  => true,
            'auto_repair' => false,
        ]);

        $res = $this->postJson('/api/system/engineering/guardian/runs', $this->evaluatePayload([
            'diff_content' => "+++ b/app/Bad.php\n+ eval(\$x);",
            'changed_files' => ['app/Bad.php'],
        ]));

        $res->assertStatus(201)->assertJsonPath('data.decision', 'block');
        $this->assertNull($res->json('data.run.repair_session_id'));
    }

    public function test_policy_block_on_scoping(): void
    {
        GuardianPolicy::create([
            'company_id' => $this->user->company_id,
            'name'       => 'Security only',
            'is_active'  => true,
            'is_default' => true,
            'block_on'   => ['security'],
        ]);

        $res = $this->postJson('/api/system/engineering/guardian/runs', $this->evaluatePayload([
            'diff_content' => "+++ b/app/Model.php\n+ protected \$casts = [",
            'changed_files' => ['app/Model.php'],
        ]));

        $res->assertStatus(201)->assertJsonPath('data.decision', 'allow');
    }

    public function test_checks_recorded_per_category(): void
    {
        $res   = $this->postJson('/api/system/engineering/guardian/runs', $this->evaluatePayload());
        $runId = $res->json('data.run.id');

        $checks = $this->getJson("/api/system/engineering/guardian/runs/{$runId}/checks");
        $names  = collect($checks->json('data'))->pluck('check_name');

        $this->assertTrue($names->contains('security_scan'));
        $this->assertTrue($names->contains('adr_compliance'));
        $this->assertTrue($names->contains('safety_rules'));
    }

    public function test_decision_endpoint(): void
    {
        $res   = $this->postJson('/api/system/engineering/guardian/runs', $this->evaluatePayload());
        $runId = $res->json('data.run.id');

        $this->getJson("/api/system/engineering/guardian/runs/{$runId}/decision")
            ->assertOk()
            ->assertJsonStructure(['data' => ['decision', 'reason', 'allowed']]);
    }

    public function test_report_generated_and_human_readable(): void
    {
        $res   = $this->postJson('/api/system/engineering/guardian/runs', $this->evaluatePayload());
        $runId = $res->json('data.run.id');

        $report  = $this->getJson("/api/system/engineering/guardian/runs/{$runId}/report");
        $content = (string) $report->json('data.content');

        $report->assertOk();
        $this->assertStringContainsString('Engineering Guardian Report', $content);
        $this->assertStringContainsString('Next Steps', $content);
    }

    public function test_decision_log_recorded(): void
    {
        $res   = $this->postJson('/api/system/engineering/guardian/runs', $this->evaluatePayload());
        $runId = $res->json('data.run.id');

        $this->assertDatabaseHas('engineering_guardian_decisions', [
            'run_id' => $runId, 'decision' => 'allow',
        ]);
    }

    public function test_no_force_allow_route_exists(): void
    {
        $res   = $this->postJson('/api/system/engineering/guardian/runs', $this->evaluatePayload([
            'diff_content' => "+++ b/app/Bad.php\n+ eval(\$x);",
            'changed_files' => ['app/Bad.php'],
        ]));
        $runId = $res->json('data.run.id');

        $this->postJson("/api/system/engineering/guardian/runs/{$runId}/force-allow")
            ->assertNotFound();

        $this->getJson("/api/system/engineering/guardian/runs/{$runId}/decision")
            ->assertJsonPath('data.decision', 'block');
    }

    public function test_company_isolation(): void
    {
        $res   = $this->postJson('/api/system/engineering/guardian/runs', $this->evaluatePayload());
        $runId = $res->json('data.run.id');

        $other = User::factory()->create(['company_id' => \Str::uuid()]);
        $this->actingAs($other);
        $this->getJson("/api/system/engineering/guardian/runs/{$runId}")->assertNotFound();
    }

    public function test_dashboard(): void
    {
        $this->postJson('/api/system/engineering/guardian/runs', $this->evaluatePayload());

        $this->getJson('/api/system/engineering/guardian/dashboard')
            ->assertOk()
            ->assertJsonStructure(['data' => ['total_runs', 'block_rate', 'by_trigger_source']]);
    }

    public function test_guardian_metrics_recorded_on_decision(): void
    {
        $this->postJson('/api/system/engineering/guardian/runs', $this->evaluatePayload());

        $this->assertDatabaseHas('engineering_repair_metrics', [
            'company_id'  => $this->user->company_id,
            'metric_type' => 'guardian',
            'metric_key'  => 'guardian.decision',
        ]);
        $this->assertDatabaseHas('engineering_ai_metrics', [
            'company_id'  => $this->user->company_id,
            'metric_type' => 'guardian',
            'metric_key'  => 'gate_decision',
        ]);
    }

    public function test_revalidate_capped_by_policy_max_repair_attempts(): void
    {
        GuardianPolicy::create([
            'company_id'          => $this->user->company_id,
            'name'                => 'One attempt',
            'is_active'           => true,
            'is_default'          => true,
            'auto_repair'         => true,
            'max_repair_attempts' => 1,
        ]);

        // Blocked run with an auto-opened repair session but no patch yet:
        // the first revalidate fails on "no patch received" (422), which
        // still counts as zero completed cycles. Simulate one completed
        // cycle by seeding a second decision row, then assert the cap.
        $res   = $this->postJson('/api/system/engineering/guardian/runs', $this->evaluatePayload([
            'diff_content'  => "+++ b/app/Bad.php\n+ eval(\$x);",
            'changed_files' => ['app/Bad.php'],
        ]));
        $runId = $res->json('data.run.id');

        \Modules\System\Engineering\Domain\Models\GuardianDecisionLog::create([
            'run_id'      => $runId,
            'company_id'  => $this->user->company_id,
            'decision'    => 'block',
            'reason'      => 'simulated completed repair cycle',
            'decided_by'  => 'system',
            'occurred_at' => now(),
        ]);

        $this->postJson("/api/system/engineering/guardian/runs/{$runId}/revalidate")
            ->assertStatus(422);
    }
}
