<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Auth\Domain\Models\User;
use Modules\System\Engineering\Domain\Models\RepairPatch;
use Modules\System\Engineering\Domain\Models\RepairSession;
use Tests\TestCase;

class SelfHealingPipelineTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create(['company_id' => \Str::uuid()]);
        $this->actingAs($this->user);

        // Stub every toolchain validator so no real tools run.
        $stub = ['php', '-r', 'exit(0);'];
        config()->set('engineering.self_healing.commands', [
            'php_syntax'         => $stub, 'composer'      => $stub,
            'laravel_validation' => $stub, 'pint'          => $stub,
            'phpstan'            => $stub, 'eslint'        => $stub,
            'typescript'         => $stub, 'build'         => $stub,
            'tests'              => $stub, 'frontend_tests' => $stub,
        ]);
        config()->set('engineering.self_healing.working_directory', storage_path('framework/testing'));
    }

    private function makePatch(array $overrides = []): RepairPatch
    {
        $session = RepairSession::create([
            'company_id'      => $this->user->company_id,
            'source_type'     => 'manual',
            'status'          => 'pending',
            'failure_type'    => 'test_failure',
            'failure_summary' => 'Test failure for pipeline test',
            'retry_count'     => 0,
            'max_retries'     => 3,
            'timeout_seconds' => 300,
        ]);

        return RepairPatch::create(array_merge([
            'session_id'     => $session->id,
            'company_id'     => $this->user->company_id,
            'patch_content'  => "+++ b/app/Example.php\n+ \$x = 1;",
            'patch_format'   => 'diff',
            'files_affected' => ['app/Example.php'],
            'lines_added'    => 1,
            'lines_removed'  => 0,
            'is_applied'     => false,
            'created_at'     => now(),
        ], $overrides));
    }

    public function test_validate_creates_run_with_all_steps(): void
    {
        $patch = $this->makePatch();
        $res   = $this->postJson("/api/system/engineering/repair/patches/{$patch->id}/validate");

        $res->assertStatus(201);
        $this->assertSame(13, $res->json('data.total_steps'));
        $validators = collect($res->json('data.steps'))->pluck('validator');
        $this->assertTrue($validators->contains('safety_rules'));
        $this->assertTrue($validators->contains('laravel_validation'));
        $this->assertTrue($validators->contains('tests'));
        $this->assertTrue($validators->contains('frontend_tests'));
    }

    public function test_clean_patch_is_accepted(): void
    {
        $patch = $this->makePatch();
        $res   = $this->postJson("/api/system/engineering/repair/patches/{$patch->id}/validate");

        $res->assertStatus(201)
            ->assertJsonPath('data.verdict', 'accepted')
            ->assertJsonPath('data.status', 'passed');
        $this->assertDatabaseHas('engineering_repair_patches', [
            'id' => $patch->id, 'verification_status' => 'passed',
        ]);
    }

    public function test_security_violation_rejects_patch(): void
    {
        $patch = $this->makePatch([
            'patch_content' => "+++ b/app/Bad.php\n+ eval(\$userInput);",
            'files_affected' => ['app/Bad.php'],
        ]);
        $res = $this->postJson("/api/system/engineering/repair/patches/{$patch->id}/validate");

        $res->assertStatus(201)->assertJsonPath('data.verdict', 'rejected');
        $this->assertTrue((bool) $res->json('data.is_blocking_failure'));
        $this->assertDatabaseHas('engineering_repair_patches', [
            'id' => $patch->id, 'verification_status' => 'failed',
        ]);
    }

    public function test_forbidden_path_rejects_patch(): void
    {
        $patch = $this->makePatch(['files_affected' => ['.env']]);
        $res   = $this->postJson("/api/system/engineering/repair/patches/{$patch->id}/validate");

        $res->assertStatus(201)->assertJsonPath('data.verdict', 'rejected');
        $this->assertStringContainsString('safety_rules', (string) $res->json('data.failure_summary'));
    }

    public function test_fail_fast_stops_at_first_blocking_failure(): void
    {
        $patch = $this->makePatch([
            'patch_content' => "+++ b/app/Bad.php\n+ eval(\$userInput);",
            'files_affected' => ['app/Bad.php'],
        ]);
        $res = $this->postJson("/api/system/engineering/repair/patches/{$patch->id}/validate");

        $steps = collect($res->json('data.steps'))->keyBy('validator');

        // Security (sequence 2) fails; nothing later executes, nothing is left open.
        $this->assertSame('failed', $steps['security']['status']);
        $this->assertSame('skipped', $steps['php_syntax']['status']);
        $this->assertSame('skipped', $steps['tests']['status']);
        $this->assertCount(13, $steps);
        $this->assertFalse($steps->pluck('status')->contains('pending'));
        $this->assertFalse($steps->pluck('status')->contains('running'));

        $this->assertDatabaseHas('engineering_validation_history', [
            'patch_id' => $patch->id, 'event_type' => 'validation.aborted',
        ]);
    }

    public function test_run_all_mode_executes_every_validator(): void
    {
        config()->set('engineering.self_healing.fail_fast', false);

        $patch = $this->makePatch([
            'patch_content' => "+++ b/app/Bad.php\n+ eval(\$userInput);",
            'files_affected' => ['app/Bad.php'],
        ]);
        $res = $this->postJson("/api/system/engineering/repair/patches/{$patch->id}/validate");

        $steps = collect($res->json('data.steps'))->keyBy('validator');
        $this->assertSame('failed', $steps['security']['status']);
        // Later applicable stages still executed in run-all mode.
        $this->assertSame('passed', $steps['php_syntax']['status']);
        $this->assertSame('passed', $steps['tests']['status']);
    }

    public function test_failed_validation_triggers_rollback_path(): void
    {
        $patch = $this->makePatch([
            'patch_content' => "+++ b/app/Bad.php\n+ eval(\$userInput);",
            'files_affected' => ['app/Bad.php'],
            'is_applied'    => true,
        ]);
        $this->postJson("/api/system/engineering/repair/patches/{$patch->id}/validate")
            ->assertJsonPath('data.verdict', 'rejected');

        // Applied patch with no snapshots: rollback attempt is recorded as
        // unavailable — the failure is never silently ignored.
        $this->assertDatabaseHas('engineering_validation_history', [
            'patch_id' => $patch->id, 'event_type' => 'rollback.unavailable',
        ]);
    }

    public function test_metrics_recorded_on_completion(): void
    {
        $patch = $this->makePatch();
        $this->postJson("/api/system/engineering/repair/patches/{$patch->id}/validate");

        $this->assertDatabaseHas('engineering_repair_metrics', [
            'company_id' => $this->user->company_id,
            'metric_type' => 'validation',
            'metric_key' => 'validation.completed',
        ]);
        $this->assertDatabaseHas('engineering_ai_metrics', [
            'company_id' => $this->user->company_id,
            'metric_type' => 'self_healing',
            'metric_key' => 'patch_validation',
        ]);
    }

    public function test_inapplicable_validators_are_skipped(): void
    {
        $patch = $this->makePatch([
            'patch_content' => "+++ b/frontend/src/x.ts\n+ const x = 1;",
            'files_affected' => ['frontend/src/x.ts'],
        ]);
        $res = $this->postJson("/api/system/engineering/repair/patches/{$patch->id}/validate");

        $steps = collect($res->json('data.steps'))->keyBy('validator');
        $this->assertSame('skipped', $steps['php_syntax']['status']);
        $this->assertNotSame('skipped', $steps['eslint']['status']);
    }

    public function test_rejected_patch_cannot_be_applied(): void
    {
        $patch = $this->makePatch([
            'patch_content' => "+++ b/app/Bad.php\n+ eval(\$userInput);",
            'files_affected' => ['app/Bad.php'],
        ]);
        $this->postJson("/api/system/engineering/repair/patches/{$patch->id}/validate")
            ->assertJsonPath('data.verdict', 'rejected');

        $res = $this->postJson(
            "/api/system/engineering/repair/sessions/{$patch->session_id}/patches/{$patch->id}/apply"
        );

        $this->assertGreaterThanOrEqual(400, $res->status());
        $this->assertDatabaseHas('engineering_repair_patches', [
            'id' => $patch->id, 'is_applied' => false,
        ]);
    }

    public function test_revalidate_increments_attempt(): void
    {
        $patch = $this->makePatch();
        $this->postJson("/api/system/engineering/repair/patches/{$patch->id}/validate");
        $res = $this->postJson("/api/system/engineering/repair/patches/{$patch->id}/revalidate");

        $res->assertStatus(201)->assertJsonPath('data.attempt_number', 2);
    }

    public function test_max_attempts_enforced(): void
    {
        config()->set('engineering.self_healing.max_attempts', 1);
        $patch = $this->makePatch();
        $this->postJson("/api/system/engineering/repair/patches/{$patch->id}/validate")->assertStatus(201);
        $this->postJson("/api/system/engineering/repair/patches/{$patch->id}/revalidate")->assertStatus(422);
    }

    public function test_report_generated(): void
    {
        $patch = $this->makePatch();
        $res   = $this->postJson("/api/system/engineering/repair/patches/{$patch->id}/validate");
        $validationId = $res->json('data.id');

        $report = $this->getJson("/api/system/engineering/repair/validations/{$validationId}/report");
        $report->assertOk();
        $this->assertStringContainsString('Patch Validation Report', (string) $report->json('data.content'));
    }

    public function test_history_recorded(): void
    {
        $patch = $this->makePatch();
        $this->postJson("/api/system/engineering/repair/patches/{$patch->id}/validate");

        $this->assertDatabaseHas('engineering_validation_history', [
            'patch_id' => $patch->id, 'event_type' => 'validation.created',
        ]);
        $this->assertDatabaseHas('engineering_validation_history', [
            'patch_id' => $patch->id, 'event_type' => 'validation.completed',
        ]);
    }

    public function test_toolchain_failure_rejects(): void
    {
        config()->set('engineering.self_healing.commands.tests', ['php', '-r', 'exit(1);']);
        $patch = $this->makePatch();
        $res   = $this->postJson("/api/system/engineering/repair/patches/{$patch->id}/validate");

        $res->assertStatus(201)->assertJsonPath('data.verdict', 'rejected');
        $steps = collect($res->json('data.steps'))->keyBy('validator');
        $this->assertSame('failed', $steps['tests']['status']);
    }

    public function test_company_isolation(): void
    {
        $patch = $this->makePatch();
        $res   = $this->postJson("/api/system/engineering/repair/patches/{$patch->id}/validate");
        $validationId = $res->json('data.id');

        $other = User::factory()->create(['company_id' => \Str::uuid()]);
        $this->actingAs($other);
        $this->getJson("/api/system/engineering/repair/validations/{$validationId}")->assertNotFound();
    }
}
