<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Modules\System\Engineering\Application\Services\AdrComplianceValidator;
use Modules\System\Engineering\Application\Services\PatchRollbackService;
use Modules\System\Engineering\Application\Services\PatchSafetyRuleEngine;
use Modules\System\Engineering\Application\Services\PatchSecurityValidator;
use Modules\System\Engineering\Domain\Models\PatchSnapshot;
use Modules\System\Engineering\Domain\Models\RepairPatch;
use Modules\System\Engineering\Domain\Models\RepairSession;
use Modules\System\Engineering\Domain\Models\ValidationRule;
use Tests\TestCase;

/**
 * TASK-ENG-V2-002 — Self-Healing Pipeline.
 *
 * Feature coverage for the static patch validators
 * (security / ADR compliance / safety rules) and snapshot + rollback.
 */
class PatchValidatorsTest extends TestCase
{
    use RefreshDatabase;

    private string $companyId;

    private string $workDir;

    protected function setUp(): void
    {
        parent::setUp();
        $this->companyId = (string) Str::uuid();
        $this->workDir   = storage_path('framework/testing/rollback-test');
    }

    protected function tearDown(): void
    {
        if (File::isDirectory($this->workDir)) {
            File::deleteDirectory($this->workDir);
        }

        parent::tearDown();
    }

    // -----------------------------------------------------------------
    // PatchSecurityValidator
    // -----------------------------------------------------------------

    public function test_security_detects_hardcoded_secret(): void
    {
        $patch = $this->makePatch(['patch_content' => <<<'DIFF'
--- a/app/Services/PaymentService.php
+++ b/app/Services/PaymentService.php
@@ -10,6 +10,7 @@
 class PaymentService
 {
+    private $api_key = "abcd1234efgh5678";
 }
DIFF]);

        $violations = app(PatchSecurityValidator::class)->analyze($patch);

        $this->assertHasViolation($violations, 'hardcoded_secret', 'critical');
    }

    public function test_security_detects_dangerous_function(): void
    {
        $patch = $this->makePatch(['patch_content' => <<<'DIFF'
--- a/app/Services/ReportService.php
+++ b/app/Services/ReportService.php
@@ -20,6 +20,7 @@

+        $output = shell_exec($cmd);

DIFF]);

        $violations = app(PatchSecurityValidator::class)->analyze($patch);

        $this->assertHasViolation($violations, 'dangerous_function', 'critical');
    }

    public function test_security_detects_debug_statements(): void
    {
        $patch = $this->makePatch(['patch_content' => <<<'DIFF'
--- a/app/Services/OrderService.php
+++ b/app/Services/OrderService.php
@@ -30,6 +30,7 @@

+        dd($order);

DIFF]);

        $violations = app(PatchSecurityValidator::class)->analyze($patch);

        $this->assertHasViolation($violations, 'debug_left_in', 'medium');
    }

    public function test_security_ignores_removed_lines(): void
    {
        $patch = $this->makePatch(['patch_content' => <<<'DIFF'
--- a/app/Services/RuleService.php
+++ b/app/Services/RuleService.php
@@ -15,7 +15,7 @@
-        $result = eval($code);
+        $result = $this->runSafely($code);
DIFF]);

        $violations = app(PatchSecurityValidator::class)->analyze($patch);

        $this->assertNoViolation($violations, 'dangerous_function');
    }

    // -----------------------------------------------------------------
    // AdrComplianceValidator
    // -----------------------------------------------------------------

    public function test_adr_flags_missing_migration_guard(): void
    {
        $patch = $this->makePatch([
            'files_affected' => ['backend/Modules/Demo/Infrastructure/Database/Migrations/2026_07_23_000000_create_demo_widgets_table.php'],
            'patch_content'  => <<<'PHP'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('demo_widgets', function ($table) {
            $table->id();
            $table->string('name');
        });
    }
};
PHP,
        ]);

        $violations = app(AdrComplianceValidator::class)->analyze($patch);

        $this->assertHasViolation($violations, 'migration_guard_missing', 'high');
    }

    public function test_adr_flags_casts_property(): void
    {
        $patch = $this->makePatch([
            'files_affected' => ['backend/Modules/Demo/Domain/Models/Widget.php'],
            'patch_content'  => <<<'DIFF'
--- a/backend/Modules/Demo/Domain/Models/Widget.php
+++ b/backend/Modules/Demo/Domain/Models/Widget.php
@@ -12,6 +12,10 @@
+    protected $casts = [
+        'meta' => 'array',
+    ];
DIFF,
        ]);

        $violations = app(AdrComplianceValidator::class)->analyze($patch);

        $this->assertHasViolation($violations, 'casts_property_used', 'medium');
    }

    // -----------------------------------------------------------------
    // PatchSafetyRuleEngine
    // -----------------------------------------------------------------

    public function test_safety_blocks_forbidden_path(): void
    {
        config(['engineering.self_healing.forbidden_paths' => ['.env', 'vendor/', '.git/']]);

        $patch = $this->makePatch([
            'files_affected' => ['.env'],
            'patch_content'  => "APP_DEBUG=true\n",
        ]);

        $violations = app(PatchSafetyRuleEngine::class)->evaluate($patch, $this->companyId);

        $this->assertHasViolation($violations, 'forbidden_path', 'critical');
    }

    public function test_safety_blocks_oversize_patch(): void
    {
        config(['engineering.self_healing.limits.max_lines_per_patch' => 10]);

        $patch = $this->makePatch([
            'files_affected' => ['app/Services/BigService.php'],
            'lines_added'    => 50,
            'lines_removed'  => 0,
            'patch_content'  => "+ // a very large patch\n",
        ]);

        $violations = app(PatchSafetyRuleEngine::class)->evaluate($patch, $this->companyId);

        $this->assertHasViolation($violations, 'max_lines_exceeded', 'high');
    }

    public function test_safety_applies_custom_db_rule(): void
    {
        ValidationRule::create([
            'company_id'  => $this->companyId,
            'rule_type'   => 'forbidden_pattern',
            'name'        => 'no_todo',
            'pattern'     => '/TODO/',
            'severity'    => 'high',
            'is_blocking' => true,
            'is_active'   => true,
        ]);

        $patch = $this->makePatch([
            'files_affected' => ['app/Services/PendingService.php'],
            'patch_content'  => <<<'DIFF'
--- a/app/Services/PendingService.php
+++ b/app/Services/PendingService.php
@@ -5,6 +5,7 @@
+        // TODO: refactor this later
DIFF,
        ]);

        $violations = app(PatchSafetyRuleEngine::class)->evaluate($patch, $this->companyId);

        $this->assertHasViolation($violations, 'no_todo', 'high');
    }

    // -----------------------------------------------------------------
    // PatchRollbackService
    // -----------------------------------------------------------------

    public function test_snapshot_and_rollback_restores_file(): void
    {
        config(['engineering.self_healing.working_directory' => $this->workDir]);
        File::ensureDirectoryExists($this->workDir);
        File::put($this->workDir.'/test-rollback.php', 'ORIGINAL');

        $patch = $this->makePatch([
            'files_affected' => ['test-rollback.php'],
            'patch_content'  => "+ patched\n",
            'is_applied'     => true,
        ]);

        $service   = app(PatchRollbackService::class);
        $snapshots = $service->snapshot($patch);

        $this->assertCount(1, $snapshots);
        $this->assertTrue($snapshots[0]->file_existed);
        $this->assertSame('ORIGINAL', $snapshots[0]->original_content);

        // Simulate the patch being applied.
        File::put($this->workDir.'/test-rollback.php', 'MODIFIED');

        $restored = $service->rollback($patch, (string) Str::uuid());

        $this->assertSame(1, $restored);
        $this->assertSame('ORIGINAL', File::get($this->workDir.'/test-rollback.php'));
        $this->assertFalse($patch->fresh()->is_applied);

        $remaining = PatchSnapshot::where('patch_id', $patch->id)->get();
        $this->assertTrue($remaining->isNotEmpty());
        $this->assertTrue($remaining->every(fn (PatchSnapshot $s) => $s->is_restored));
    }

    public function test_rollback_removes_created_files(): void
    {
        config(['engineering.self_healing.working_directory' => $this->workDir]);
        File::ensureDirectoryExists($this->workDir);

        $patch = $this->makePatch([
            'files_affected' => ['new-file-created.php'],
            'patch_content'  => "+ new file\n",
            'is_applied'     => true,
        ]);

        $service   = app(PatchRollbackService::class);
        $snapshots = $service->snapshot($patch);

        $this->assertCount(1, $snapshots);
        $this->assertFalse($snapshots[0]->file_existed);

        // Simulate the patch creating the file.
        File::put($this->workDir.'/new-file-created.php', 'CREATED BY PATCH');

        $service->rollback($patch, (string) Str::uuid());

        $this->assertFalse(File::exists($this->workDir.'/new-file-created.php'));
        $this->assertFalse($patch->fresh()->is_applied);
    }

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

    private function makePatch(array $attributes = []): RepairPatch
    {
        $session = RepairSession::create([
            'company_id'      => $this->companyId,
            'source_type'     => 'pipeline',
            'status'          => 'pending',
            'failure_type'    => 'test_failure',
            'failure_summary' => 'Feature test failure for patch validator tests',
        ]);

        return RepairPatch::create(array_merge([
            'session_id'     => $session->id,
            'company_id'     => $this->companyId,
            'patch_content'  => '',
            'patch_format'   => 'diff',
            'files_affected' => ['app/Example.php'],
            'lines_added'    => 1,
            'lines_removed'  => 0,
            'is_applied'     => false,
            'created_at'     => now(),
        ], $attributes));
    }

    private function assertHasViolation(array $violations, string $rule, ?string $severity = null): void
    {
        $matches = array_values(array_filter(
            $violations,
            fn (array $v) => ($v['rule'] ?? null) === $rule
        ));

        $this->assertNotEmpty($matches, sprintf(
            'Expected violation "%s" but got: [%s]',
            $rule,
            implode(', ', array_column($violations, 'rule'))
        ));

        if ($severity !== null) {
            $this->assertSame($severity, $matches[0]['severity']);
        }
    }

    private function assertNoViolation(array $violations, string $rule): void
    {
        $this->assertNotContains($rule, array_column($violations, 'rule'), sprintf(
            'Did not expect violation "%s" but it was reported.',
            $rule
        ));
    }
}
