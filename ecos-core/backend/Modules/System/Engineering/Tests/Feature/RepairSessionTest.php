<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Auth\Domain\Models\User;
use Tests\TestCase;

class RepairSessionTest extends TestCase
{
    use RefreshDatabase;

    private const BASE = '/api/system/engineering/repair/sessions';

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create(['company_id' => \Str::uuid()]);
        $this->actingAs($this->user);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private function sessionPayload(array $overrides = []): array
    {
        return array_merge([
            'source_type'     => 'manual',
            'failure_type'    => 'test_failure',
            'failure_summary' => 'OrderTest::test_can_create_order failed: expected 201, got 500',
            'failure_context' => [
                'error_message' => 'Failed asserting that 500 matches expected 201.',
                'file'          => 'Modules/Commerce/Orders/Application/Services/OrderService.php',
            ],
        ], $overrides);
    }

    private function createSession(array $overrides = []): string
    {
        $res = $this->postJson(self::BASE, $this->sessionPayload($overrides));
        $res->assertStatus(201);

        return $res->json('data.id');
    }

    private function analyzeSession(string $id): void
    {
        $this->postJson(self::BASE . "/{$id}/analyze")->assertOk();
    }

    /** Drives a session to awaiting_response and returns the prompt package payload. */
    private function generatePrompt(string $id): array
    {
        $res = $this->postJson(self::BASE . "/{$id}/generate-prompt");
        $res->assertOk();

        return $res->json('data');
    }

    private function sampleDiff(): string
    {
        return implode("\n", [
            '--- a/Modules/Commerce/Orders/Application/Services/OrderService.php',
            '+++ b/Modules/Commerce/Orders/Application/Services/OrderService.php',
            '@@ -10,7 +10,7 @@',
            '-        return $this->error(500);',
            '+        return $this->success($order, 201);',
        ]);
    }

    // ── Creation ────────────────────────────────────────────────────────────

    public function test_can_create_repair_session(): void
    {
        $res = $this->postJson(self::BASE, $this->sessionPayload());

        $res->assertStatus(201)
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.retry_count', 0);

        $this->assertDatabaseHas('engineering_repair_sessions', [
            'company_id'   => $this->user->company_id,
            'source_type'  => 'manual',
            'failure_type' => 'test_failure',
        ]);
    }

    public function test_create_validates_source_type(): void
    {
        $res = $this->postJson(self::BASE, $this->sessionPayload(['source_type' => 'not_a_valid_source']));

        $res->assertStatus(422);
    }

    // ── Listing / Reading ───────────────────────────────────────────────────

    public function test_can_list_sessions(): void
    {
        foreach (range(1, 3) as $i) {
            $this->createSession(['failure_summary' => "Failure number {$i}"]);
        }

        $res = $this->getJson(self::BASE);

        $res->assertOk();
        $this->assertCount(3, $res->json('data.data'));
    }

    public function test_list_filters_by_status(): void
    {
        $this->createSession();
        $this->createSession();
        $cancelledId = $this->createSession();
        $this->postJson(self::BASE . "/{$cancelledId}/cancel")->assertOk();

        $res = $this->getJson(self::BASE . '?status=pending');

        $res->assertOk();
        $this->assertCount(2, $res->json('data.data'));
        foreach ($res->json('data.data') as $row) {
            $this->assertSame('pending', $row['status']);
        }
    }

    public function test_can_show_session(): void
    {
        $id = $this->createSession();

        $res = $this->getJson(self::BASE . "/{$id}");

        $res->assertOk()->assertJsonPath('data.id', $id);
    }

    // ── Analysis ────────────────────────────────────────────────────────────

    public function test_can_analyze_session(): void
    {
        $id = $this->createSession();

        $res = $this->postJson(self::BASE . "/{$id}/analyze");

        $res->assertOk()->assertJsonPath('data.status', 'analyzing');
        $this->assertNotNull($res->json('data.analysis.root_cause'));
        $this->assertNotNull($res->json('data.analysis.confidence_score'));
        $this->assertDatabaseHas('engineering_repair_analyses', ['session_id' => $id]);
    }

    // ── Prompt generation ───────────────────────────────────────────────────

    public function test_can_generate_prompt_after_analysis(): void
    {
        $id = $this->createSession();
        $this->analyzeSession($id);

        $package = $this->generatePrompt($id);

        $this->assertNotNull($package['prompt_id']);
        $this->assertNotEmpty($package['formatted_prompt']);
        $this->assertDatabaseHas('engineering_repair_sessions', [
            'id'     => $id,
            'status' => 'awaiting_response',
        ]);
    }

    public function test_generate_prompt_requires_analysis(): void
    {
        $id = $this->createSession();

        $res = $this->postJson(self::BASE . "/{$id}/generate-prompt");

        $this->assertContains($res->status(), [422, 500], 'Prompt generation without analysis must error');
        $this->assertDatabaseMissing('engineering_repair_sessions', [
            'id'     => $id,
            'status' => 'awaiting_response',
        ]);
    }

    // ── Response / Patch lifecycle ──────────────────────────────────────────

    public function test_can_submit_response(): void
    {
        $id = $this->createSession();
        $this->analyzeSession($id);
        $this->generatePrompt($id);

        $res = $this->postJson(self::BASE . "/{$id}/response", [
            'response_type'    => 'patch',
            'response_content' => $this->sampleDiff(),
        ]);

        $res->assertOk();
        $this->assertNotEmpty($res->json('data.patches'));
        $this->assertDatabaseHas('engineering_repair_patches', ['session_id' => $id]);
    }

    public function test_can_apply_patch_and_complete(): void
    {
        $id = $this->createSession();
        $this->analyzeSession($id);
        $this->generatePrompt($id);

        $submit = $this->postJson(self::BASE . "/{$id}/response", [
            'response_type'    => 'patch',
            'response_content' => $this->sampleDiff(),
        ]);
        $submit->assertOk();
        $patchId = $submit->json('data.patches.0.id');
        $this->assertNotNull($patchId);

        $this->postJson(self::BASE . "/{$id}/patches/{$patchId}/apply")->assertOk();
        $this->assertDatabaseHas('engineering_repair_patches', [
            'id'         => $patchId,
            'is_applied' => true,
        ]);

        $res = $this->postJson(self::BASE . "/{$id}/complete");

        $res->assertOk()->assertJsonPath('data.status', 'completed');
        $this->assertDatabaseHas('engineering_repair_sessions', [
            'id'     => $id,
            'status' => 'completed',
        ]);
    }

    // ── Terminal transitions ────────────────────────────────────────────────

    public function test_can_cancel_session(): void
    {
        $id = $this->createSession();

        $res = $this->postJson(self::BASE . "/{$id}/cancel");

        $res->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->assertDatabaseHas('engineering_repair_sessions', [
            'id'     => $id,
            'status' => 'cancelled',
        ]);
    }

    public function test_can_fail_session_with_reason(): void
    {
        $id = $this->createSession();
        $this->analyzeSession($id);

        $res = $this->postJson(self::BASE . "/{$id}/fail", [
            'reason' => 'Analysis inconclusive after manual review',
        ]);

        $res->assertOk()
            ->assertJsonPath('data.status', 'failed')
            ->assertJsonPath('data.failed_reason', 'Analysis inconclusive after manual review');
        $this->assertDatabaseHas('engineering_repair_sessions', [
            'id'            => $id,
            'status'        => 'failed',
            'failed_reason' => 'Analysis inconclusive after manual review',
        ]);
    }

    // ── History / Audit ─────────────────────────────────────────────────────

    public function test_history_records_events(): void
    {
        $id = $this->createSession();
        $this->analyzeSession($id);

        $res = $this->getJson(self::BASE . "/{$id}/history");

        $res->assertOk();
        $events = array_column($res->json('data'), 'event_type');
        $this->assertContains('session.created', $events);
        $this->assertContains('status.changed', $events);
    }

    // ── Tenant isolation ────────────────────────────────────────────────────

    public function test_company_isolation(): void
    {
        $id = $this->createSession();

        $intruder = User::factory()->create(['company_id' => \Str::uuid()]);
        $this->actingAs($intruder);

        $this->getJson(self::BASE . "/{$id}")->assertNotFound();
    }
}
