<?php

declare(strict_types=1);

namespace Tests\Feature\Operations;

use App\Core\FeatureFlags\FeatureFlagService;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Operations\Preparation\Application\Actions\ApproveSessionAction;
use Modules\Operations\Preparation\Application\Actions\CloseSessionAction;
use Modules\Operations\Preparation\Application\Actions\PlanSessionAction;
use Modules\Operations\Preparation\Domain\Enums\QualityStatus;
use Modules\Operations\Preparation\Domain\Enums\SessionStatus;
use Modules\Operations\Preparation\Domain\Events\SessionApproved;
use Modules\Operations\Preparation\Domain\Events\SessionClosed;
use Modules\Operations\Preparation\Domain\Events\SessionPlanned;
use Modules\Operations\Preparation\Domain\Models\PreparationSession;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;
use Modules\Operations\Preparation\Domain\Models\PreparedProductsPool;
use Modules\Organization\Companies\Domain\Models\Company;
use RuntimeException;
use Tests\TestCase;

class PreparationSessionLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Company $company;

    private Warehouse $warehouse;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);
        $this->user = User::factory()->create(['company_id' => $this->company->id]);

        $flags = app(FeatureFlagService::class);
        $flags->enable('modules.preparation_os', $this->company->id);
        $flags->enable('workflow.stages.preparation', $this->company->id);
    }

    private function makeSession(string $status = 'draft'): PreparationSession
    {
        return PreparationSession::create([
            'company_id' => $this->company->id,
            'warehouse_id' => $this->warehouse->id,
            'session_number' => 'SESS-'.Str::random(6),
            'planning_date' => now()->addDay()->toDateString(),
            'status' => $status,
            'operator_id' => (string) $this->user->id,
            'waves_count' => 0,
            'products_count' => 0,
            'total_units_required' => 0,
            'total_units_prepared' => 0,
            'created_by' => (string) $this->user->id,
            'updated_by' => (string) $this->user->id,
        ]);
    }

    private function makeWave(string $sessionId): PreparationWave
    {
        return PreparationWave::create([
            'company_id' => $this->company->id,
            'warehouse_id' => $this->warehouse->id,
            'wave_number' => 'PREP-'.now()->format('Ym').'-'.str_pad((string) random_int(1, 9999), 6, '0', STR_PAD_LEFT),
            'planning_date' => now()->addDay()->toDateString(),
            'status' => 'completed',
            'preparation_session_id' => $sessionId,
            'orders_count' => 0,
            'products_count' => 0,
            'lines_count' => 0,
            'total_units_required' => 0,
            'total_units_prepared' => 0,
            'shortage_detected' => false,
            'created_by' => (string) $this->user->id,
            'updated_by' => (string) $this->user->id,
        ]);
    }

    // ── P1A: Plan ─────────────────────────────────────────────────────────────

    public function test_plan_session_transitions_draft_to_planning(): void
    {
        Event::fake([SessionPlanned::class]);

        $session = $this->makeSession('draft');
        $result = app(PlanSessionAction::class)->execute($session, (string) $this->user->id);

        $this->assertEquals(SessionStatus::Planning->value, $result->status->value);
        $this->assertNotNull($result->planned_at);
        $this->assertEquals((string) $this->user->id, $result->planned_by);
        Event::assertDispatched(SessionPlanned::class);
    }

    public function test_plan_session_fails_if_already_completed(): void
    {
        $this->expectException(RuntimeException::class);

        $session = $this->makeSession('completed');
        app(PlanSessionAction::class)->execute($session, (string) $this->user->id);
    }

    // ── P1A: Approve ─────────────────────────────────────────────────────────

    public function test_approve_session_transitions_completed_to_approved_and_opens_gates(): void
    {
        Event::fake([SessionApproved::class]);

        $session = $this->makeSession('completed');
        $wave = $this->makeWave($session->id);

        PreparedProductsPool::create([
            'company_id' => $this->company->id,
            'warehouse_id' => $this->warehouse->id,
            'product_id' => Str::uuid()->toString(),
            'sku_snapshot' => 'SKU-GATE-TEST',
            'name_snapshot' => 'Gate Test Product',
            'preparation_wave_id' => $wave->id,
            'quantity_available' => 10,
            'quantity_reserved' => 0,
            'quantity_loaded' => 0,
            'quality_status' => QualityStatus::PendingReview->value,
            'shipping_gate_opened' => false,
            'prepared_at' => now(),
            'created_by' => (string) $this->user->id,
            'updated_by' => (string) $this->user->id,
        ]);

        $result = app(ApproveSessionAction::class)->execute($session, (string) $this->user->id);

        $this->assertEquals(SessionStatus::Approved->value, $result->status->value);
        $this->assertNotNull($result->approved_at);

        $this->assertTrue(
            (bool) PreparedProductsPool::where('preparation_wave_id', $wave->id)->value('shipping_gate_opened'),
        );

        Event::assertDispatched(SessionApproved::class, fn (SessionApproved $e) => $e->session->id === $session->id && $e->poolEntriesOpened === 1,
        );
    }

    public function test_approve_session_fails_if_not_completed(): void
    {
        $this->expectException(RuntimeException::class);

        $session = $this->makeSession('in_progress');
        app(ApproveSessionAction::class)->execute($session, (string) $this->user->id);
    }

    // ── P1A: Close ───────────────────────────────────────────────────────────

    public function test_close_session_transitions_approved_to_closed(): void
    {
        Event::fake([SessionClosed::class]);

        $session = $this->makeSession('approved');
        $result = app(CloseSessionAction::class)->execute($session, (string) $this->user->id);

        $this->assertEquals(SessionStatus::Closed->value, $result->status->value);
        $this->assertNotNull($result->closed_at);
        $this->assertEquals((string) $this->user->id, $result->closed_by);
        Event::assertDispatched(SessionClosed::class);
    }

    public function test_close_session_fails_if_not_approved(): void
    {
        $this->expectException(RuntimeException::class);

        $session = $this->makeSession('completed');
        app(CloseSessionAction::class)->execute($session, (string) $this->user->id);
    }

    // ── P1A: Terminal state ───────────────────────────────────────────────────

    public function test_closed_session_cannot_be_planned_again(): void
    {
        $this->expectException(RuntimeException::class);

        $session = $this->makeSession('closed');
        app(PlanSessionAction::class)->execute($session, (string) $this->user->id);
    }
}
