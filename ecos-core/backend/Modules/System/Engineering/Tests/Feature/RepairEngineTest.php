<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Auth\Domain\Models\User;
use Modules\System\Engineering\Application\Services\ClaudeCodeIntegration;
use Modules\System\Engineering\Application\Services\FailureAnalysisEngine;
use Modules\System\Engineering\Application\Services\RepairEngine;
use Modules\System\Engineering\Application\Services\RepairPromptBuilder;
use Modules\System\Engineering\Application\Services\RepairSessionManager;
use Modules\System\Engineering\Application\Services\RetryPolicyEngine;
use Modules\System\Engineering\Application\Services\RootCauseClassifier;
use Modules\System\Engineering\Domain\Enums\RepairSessionStatus;
use Modules\System\Engineering\Domain\Models\RepairAnalysis;
use Modules\System\Engineering\Domain\Models\RepairSession;
use Tests\TestCase;

class RepairEngineTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create(['company_id' => \Str::uuid()]);
        $this->actingAs($this->user);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private function companyId(): string
    {
        return (string) $this->user->company_id;
    }

    private function richContext(): array
    {
        return [
            'error_message' => 'Parse error: syntax error, unexpected token "}" in OrderService.php on line 42',
            'stack_trace'   => "#0 /var/www/html/Modules/Orders/OrderService.php(42)\n#1 {main}",
            'file'          => 'Modules/Orders/Application/Services/OrderService.php',
        ];
    }

    private function initiateSession(string $failureType = 'build_failure', array $context = []): RepairSession
    {
        return app(RepairEngine::class)->initiate(
            $this->companyId(),
            'pipeline',
            null,
            $failureType,
            'Build failed on main branch',
            $context,
        );
    }

    /** Initiate + analyze, returning [session, analysis]. */
    private function analyzedSession(): array
    {
        $session  = $this->initiateSession('build_failure', $this->richContext());
        $session  = app(RepairEngine::class)->analyze($session);
        $analysis = RepairAnalysis::where('session_id', $session->id)->firstOrFail();

        return [$session, $analysis];
    }

    // ------------------------------------------------------------------
    // 1. Root cause classification
    // ------------------------------------------------------------------

    public function test_root_cause_classifier_detects_syntax_error(): void
    {
        $rootCause = app(RootCauseClassifier::class)->classify('build_failure', [
            'error_message' => 'Parse error: syntax error unexpected token',
        ]);

        $this->assertSame('syntax_error', $rootCause);
    }

    public function test_classifier_falls_back_to_general(): void
    {
        $rootCause = app(RootCauseClassifier::class)->classify('build_failure', []);

        $this->assertSame('build_failure_general', $rootCause);
    }

    // ------------------------------------------------------------------
    // 3. Analysis confidence
    // ------------------------------------------------------------------

    public function test_analysis_confidence_scales_with_evidence(): void
    {
        [, $analysis] = $this->analyzedSession();

        // error_message (+15) + stack_trace (+15) + file (+10) on 50 base = 90
        $this->assertGreaterThanOrEqual(80, (float) $analysis->confidence_score);
    }

    // ------------------------------------------------------------------
    // 4. Retry policy defaults
    // ------------------------------------------------------------------

    public function test_default_max_retries_by_failure_type(): void
    {
        $engine = app(RetryPolicyEngine::class);

        $this->assertSame(3, $engine->getDefaultMaxRetries('build_failure'));
        $this->assertSame(1, $engine->getDefaultMaxRetries('security_issue'));
        $this->assertSame(2, $engine->getDefaultMaxRetries('quality_issue'));
    }

    // ------------------------------------------------------------------
    // 5. Retry execution
    // ------------------------------------------------------------------

    public function test_retry_increments_count(): void
    {
        $engine  = app(RepairEngine::class);
        $session = $this->initiateSession('build_failure');

        $this->assertSame(0, $session->retry_count);
        $this->assertSame(3, $session->max_retries);

        $this->assertTrue($engine->retry($session));

        $session->refresh();
        $this->assertSame(1, $session->retry_count);
        $this->assertSame(RepairSessionStatus::Retrying, $session->status);

        // Exhaust retries: at retry_count == max_retries no further retry is allowed.
        $session->update(['retry_count' => $session->max_retries]);
        $this->assertFalse($engine->retry($session->fresh()));
    }

    // ------------------------------------------------------------------
    // 6. State machine guard
    // ------------------------------------------------------------------

    public function test_invalid_status_transition_throws(): void
    {
        $session = $this->initiateSession('build_failure');
        $this->assertSame(RepairSessionStatus::Pending, $session->status);

        $this->expectException(\RuntimeException::class);

        app(RepairSessionManager::class)->transition($session, RepairSessionStatus::Completed);
    }

    // ------------------------------------------------------------------
    // 7. Prompt versioning
    // ------------------------------------------------------------------

    public function test_prompt_builder_versions_increment(): void
    {
        [$session, $analysis] = $this->analyzedSession();

        $builder = app(RepairPromptBuilder::class);

        $first  = $builder->build($session, $analysis);
        $second = $builder->build($session, $analysis);

        $this->assertSame(1, $first->prompt_version);
        $this->assertSame(2, $second->prompt_version);
        $this->assertTrue((bool) $second->is_active);
        $this->assertFalse((bool) $first->fresh()->is_active);
    }

    // ------------------------------------------------------------------
    // 8. Claude package format
    // ------------------------------------------------------------------

    public function test_claude_package_format(): void
    {
        [$session, $analysis] = $this->analyzedSession();

        $prompt  = app(RepairPromptBuilder::class)->build($session, $analysis);
        $package = app(ClaudeCodeIntegration::class)->prepareClaudePackage($session, $prompt);

        $this->assertArrayHasKey('formatted_prompt', $package);
        $this->assertStringContainsString('# System Context', $package['formatted_prompt']);
        $this->assertStringContainsString('# Repair Instructions', $package['formatted_prompt']);
        $this->assertSame($session->id, $package['session_id']);
        $this->assertSame($prompt->id, $package['prompt_id']);
    }

    // ------------------------------------------------------------------
    // 9. Patch extraction
    // ------------------------------------------------------------------

    public function test_patch_extraction_counts_diff_lines(): void
    {
        [$session, $analysis] = $this->analyzedSession();

        $integration = app(ClaudeCodeIntegration::class);
        $prompt      = app(RepairPromptBuilder::class)->build($session, $analysis);

        $diff = implode("\n", [
            '--- a/Modules/Orders/Application/Services/OrderService.php',
            '+++ b/Modules/Orders/Application/Services/OrderService.php',
            '@@ -40,4 +40,4 @@',
            ' public function handle(): void',
            ' {',
            '-    $total = $order->total(;',
            '+    $total = $order->total();',
            ' }',
        ]);

        $response = $integration->receiveResponse($session, $prompt, $diff, 'patch');
        $patch    = $integration->extractPatch($response);

        $this->assertNotNull($patch);
        $this->assertSame('diff', $patch->patch_format);
        $this->assertGreaterThan(0, $patch->lines_added);
        $this->assertGreaterThan(0, $patch->lines_removed);
    }

    // ------------------------------------------------------------------
    // 10. Full lifecycle audit metric
    // ------------------------------------------------------------------

    public function test_audit_metric_recorded_on_complete(): void
    {
        $engine  = app(RepairEngine::class);
        $session = $this->initiateSession('build_failure', $this->richContext());

        $session = $engine->analyze($session);
        $engine->generatePrompt($session);
        $session = $session->fresh();

        $diff = implode("\n", [
            '@@ -1,1 +1,1 @@',
            '-broken line',
            '+fixed line',
        ]);
        $session = $engine->submitResponse($session, $diff, 'patch');

        $patch   = $session->patches()->firstOrFail();
        $session = $engine->applyPatch($session, $patch->id, (string) $this->user->id);

        $engine->complete($session, (string) $this->user->id);

        $this->assertDatabaseHas('engineering_repair_sessions', [
            'id'     => $session->id,
            'status' => 'completed',
        ]);
        $this->assertDatabaseHas('engineering_repair_metrics', [
            'metric_key' => 'session_completed',
        ]);
    }
}
