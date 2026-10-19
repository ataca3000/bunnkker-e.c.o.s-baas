<?php

declare(strict_types=1);

namespace Tests\Feature\Operations;

use App\Core\FeatureFlags\FeatureFlagService;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Modules\IAM\Domain\Models\Role;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Operations\Preparation\Application\Actions\AnalyzeMaterialsAction;
use Modules\Operations\Preparation\Application\Actions\CancelWaveAction;
use Modules\Operations\Preparation\Application\Actions\CompleteProductAction;
use Modules\Operations\Preparation\Application\Actions\CompleteWaveAction;
use Modules\Operations\Preparation\Application\Actions\CreateWaveAction;
use Modules\Operations\Preparation\Application\Actions\GenerateDemandAction;
use Modules\Operations\Preparation\Application\Actions\StartPreparationAction;
use Modules\Operations\Preparation\Application\DTOs\CreateWaveDTO;
use Modules\Operations\Preparation\Application\DTOs\StartPreparationDTO;
use Modules\Operations\Preparation\Domain\Enums\WaveItemStatus;
use Modules\Operations\Preparation\Domain\Enums\WaveStatus;
use Modules\Operations\Preparation\Domain\Events\ProductPrepared;
use Modules\Operations\Preparation\Domain\Events\WaveCancelled;
use Modules\Operations\Preparation\Domain\Events\WaveCompleted;
use Modules\Operations\Preparation\Domain\Events\WaveCreated;
use Modules\Operations\Preparation\Domain\Events\WaveStarted;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;
use Modules\Operations\Preparation\Domain\Models\PreparationWaveItem;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * PKG-PREP-002B-03HF: Integration tests for Preparation OS wave lifecycle.
 *
 * Covers: Events, Timeline, Audit, Policies, Feature Flags.
 */
class PreparationWaveActionsTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    /**
     * users.id is bigint, but the Preparation DTOs and actions declare
     * `string $actorId`. Production casts at the boundary — see
     * PreparationWaveController:214 and :531, `actorId: (string) $request->user()->id`.
     * The fixture follows the same convention instead of passing a raw int.
     */
    private string $actorId;

    private Company $company;

    private Warehouse $warehouse;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);
        $this->user = User::factory()->create(['company_id' => $this->company->id]);
        $this->actorId = (string) $this->user->id;

        $role = Role::create([
            'name' => 'System Admin',
            'slug' => 'sysadmin',
            'is_system' => true,
        ]);
        $this->user->roles()->attach($role->id);

        $flags = app(FeatureFlagService::class);
        $flags->enable('modules.preparation_os', $this->company->id);
        $flags->enable('workflow.stages.preparation', $this->company->id);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeWave(WaveStatus $status = WaveStatus::Draft): PreparationWave
    {
        return PreparationWave::create([
            'company_id' => $this->company->id,
            'warehouse_id' => $this->warehouse->id,
            'wave_number' => 'PREP-'.now()->format('Ym').'-'.str_pad((string) random_int(1, 9999), 6, '0', STR_PAD_LEFT),
            'planning_date' => now()->addDay()->toDateString(),
            'status' => $status->value,
            'orders_count' => 0,
            'products_count' => 0,
            'lines_count' => 0,
            'total_units_required' => 0,
            'total_units_prepared' => 0,
            'shortage_detected' => false,
            'created_by' => $this->user->id,
            'updated_by' => $this->user->id,
        ]);
    }

    private function makeWaveItem(PreparationWave $wave, float $qty = 5.0): PreparationWaveItem
    {
        return PreparationWaveItem::create([
            'company_id' => $wave->company_id,
            'preparation_wave_id' => $wave->id,
            'product_id' => Str::uuid()->toString(),
            'sku_snapshot' => 'SKU-TEST-'.uniqid(),
            'name_snapshot' => 'Test Product',
            'quantity_required' => $qty,
            'quantity_prepared' => 0,
            'quantity_short' => 0,
            'status' => WaveItemStatus::Pending->value,
            'created_by' => $this->user->id,
            'updated_by' => $this->user->id,
        ]);
    }

    private function waveApiPath(string $waveId, string $suffix = ''): string
    {
        return "/api/preparation/waves/{$waveId}".($suffix ? "/{$suffix}" : '');
    }

    // ── 1. Create Wave ────────────────────────────────────────────────────────

    public function test_create_wave_fires_event_and_writes_timeline_and_audit(): void
    {
        Event::fake([WaveCreated::class]);

        $dto = new CreateWaveDTO(
            companyId: $this->company->id,
            warehouseId: $this->warehouse->id,
            planningDate: now()->addDay()->toDateString(),
            orderLines: [],
            actorId: $this->actorId,
        );

        $wave = app(CreateWaveAction::class)->execute($dto);

        Event::assertDispatched(WaveCreated::class, fn ($e) => $e->waveId === $wave->id);

        $this->assertDatabaseHas('timeline_events', [
            'subject_type' => 'PreparationWave',
            'subject_id' => $wave->id,
            'event_type' => 'wave.created',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'entity_type' => 'PreparationWave',
            'entity_id' => $wave->id,
            'action' => 'preparation.wave.created',
        ]);

        $this->assertSame(WaveStatus::Draft->value, $wave->status->value);
    }

    // ── 2. Generate Demand ────────────────────────────────────────────────────

    public function test_generate_demand_transitions_to_planning_and_writes_timeline(): void
    {
        $wave = $this->makeWave(WaveStatus::Draft);

        $result = app(GenerateDemandAction::class)->execute($wave, $this->actorId);

        $this->assertSame(WaveStatus::Planning->value, $result->status->value);

        $this->assertDatabaseHas('timeline_events', [
            'subject_type' => 'PreparationWave',
            'subject_id' => $wave->id,
            'event_type' => 'wave.demand_generated',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'entity_type' => 'PreparationWave',
            'entity_id' => $wave->id,
            'action' => 'preparation.wave.demand_generated',
        ]);
    }

    // ── 3. Analyze Materials ─────────────────────────────────────────────────

    public function test_analyze_materials_writes_timeline_and_audit(): void
    {
        $wave = $this->makeWave(WaveStatus::Planning);

        $result = app(AnalyzeMaterialsAction::class)->execute($wave, $this->actorId);

        $this->assertDatabaseHas('timeline_events', [
            'subject_type' => 'PreparationWave',
            'subject_id' => $wave->id,
            'event_type' => 'wave.materials_analyzed',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'entity_type' => 'PreparationWave',
            'entity_id' => $wave->id,
            'action' => 'preparation.wave.materials_analyzed',
        ]);

        // With no BOMs in DB, result stays Planning (no shortages)
        $this->assertContains($result->status->value, [
            WaveStatus::Planning->value,
            WaveStatus::ShortageBlocked->value,
        ]);
    }

    // ── 4. Start Preparation ─────────────────────────────────────────────────

    public function test_start_preparation_fires_event_and_writes_timeline(): void
    {
        Event::fake([WaveStarted::class]);

        $wave = $this->makeWave(WaveStatus::Planning);
        $this->makeWaveItem($wave);
        $wave->load('waveItems');

        $dto = new StartPreparationDTO(actorId: $this->actorId);
        $result = app(StartPreparationAction::class)->execute($wave, $dto);

        Event::assertDispatched(WaveStarted::class, fn ($e) => $e->waveId === $wave->id);

        $this->assertSame(WaveStatus::Preparing->value, $result->status->value);

        $this->assertDatabaseHas('timeline_events', [
            'subject_type' => 'PreparationWave',
            'subject_id' => $wave->id,
            'event_type' => 'wave.started',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'entity_type' => 'PreparationWave',
            'entity_id' => $wave->id,
            'action' => 'preparation.wave.started',
        ]);
    }

    // ── 5. Complete Product ───────────────────────────────────────────────────

    public function test_complete_product_fires_event_and_writes_timeline(): void
    {
        Event::fake([ProductPrepared::class]);

        $wave = $this->makeWave(WaveStatus::Preparing);
        $item = $this->makeWaveItem($wave, 5.0);

        $result = app(CompleteProductAction::class)->execute(
            $wave,
            $item,
            5.0,
            $this->actorId,
        );

        Event::assertDispatched(ProductPrepared::class, fn ($e) => $e->waveItemId === $item->id);

        $this->assertSame(WaveItemStatus::Prepared->value, $result->status->value);
        $this->assertSame(5.0, (float) $result->quantity_prepared);

        $this->assertDatabaseHas('timeline_events', [
            'subject_type' => 'PreparationWave',
            'subject_id' => $wave->id,
            'event_type' => 'wave.product_prepared',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'entity_type' => 'PreparationWaveItem',
            'entity_id' => $item->id,
            'action' => 'preparation.wave_item.completed',
        ]);
    }

    // ── 6. Complete Wave ─────────────────────────────────────────────────────

    public function test_complete_wave_fires_event_and_writes_timeline(): void
    {
        Event::fake([WaveCompleted::class]);

        // Wave with no incomplete items (all Prepared)
        $wave = $this->makeWave(WaveStatus::Preparing);
        $wave->update(['total_units_required' => 0]);
        $wave->load('waveItems');

        $result = app(CompleteWaveAction::class)->execute($wave, $this->actorId);

        Event::assertDispatched(WaveCompleted::class, fn ($e) => $e->waveId === $wave->id);

        $this->assertSame(WaveStatus::Completed->value, $result->status->value);

        $this->assertDatabaseHas('timeline_events', [
            'subject_type' => 'PreparationWave',
            'subject_id' => $wave->id,
            'event_type' => 'wave.completed',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'entity_type' => 'PreparationWave',
            'entity_id' => $wave->id,
            'action' => 'preparation.wave.completed',
        ]);
    }

    // ── 7. Cancel Wave ───────────────────────────────────────────────────────

    public function test_cancel_wave_fires_event_and_writes_timeline(): void
    {
        Event::fake([WaveCancelled::class]);

        $wave = $this->makeWave(WaveStatus::Planning);

        $result = app(CancelWaveAction::class)->execute($wave, $this->actorId, 'Test cancellation reason');

        Event::assertDispatched(WaveCancelled::class, fn ($e) => $e->waveId === $wave->id);

        $this->assertSame(WaveStatus::Cancelled->value, $result->status->value);
        $this->assertSame('Test cancellation reason', $result->cancellation_reason);

        $this->assertDatabaseHas('timeline_events', [
            'subject_type' => 'PreparationWave',
            'subject_id' => $wave->id,
            'event_type' => 'wave.cancelled',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'entity_type' => 'PreparationWave',
            'entity_id' => $wave->id,
            'action' => 'preparation.wave.cancelled',
        ]);
    }

    // ── 8. Feature Flag: workflow.stages.preparation ─────────────────────────

    public function test_workflow_stage_flag_disabled_blocks_create_wave(): void
    {
        $flags = app(FeatureFlagService::class);
        $flags->disable('workflow.stages.preparation', $this->company->id);

        $this->expectException(\Symfony\Component\HttpKernel\Exception\HttpException::class);

        $dto = new CreateWaveDTO(
            companyId: $this->company->id,
            warehouseId: $this->warehouse->id,
            planningDate: now()->addDay()->toDateString(),
            orderLines: [],
            actorId: $this->actorId,
        );

        app(CreateWaveAction::class)->execute($dto);
    }

    public function test_workflow_stage_flag_disabled_blocks_cancel_wave(): void
    {
        $flags = app(FeatureFlagService::class);
        $flags->disable('workflow.stages.preparation', $this->company->id);

        $this->expectException(\Symfony\Component\HttpKernel\Exception\HttpException::class);

        $wave = $this->makeWave(WaveStatus::Planning);

        app(CancelWaveAction::class)->execute($wave, $this->actorId, 'Reason');
    }

    // ── 9. Feature Flag: modules.preparation_os (API) ────────────────────────

    public function test_module_flag_disabled_returns_503_from_api(): void
    {
        $flags = app(FeatureFlagService::class);
        $flags->disable('modules.preparation_os', $this->company->id);

        $this->actingAs($this->user)
            ->getJson('/api/preparation/waves')
            ->assertStatus(503);
    }

    // ── 10. Policy: unauthenticated ───────────────────────────────────────────

    public function test_unauthenticated_request_returns_401(): void
    {
        $this->getJson('/api/preparation/waves')
            ->assertStatus(401);
    }

    // ── 11. Policy: company isolation ────────────────────────────────────────

    public function test_wrong_company_user_cannot_view_wave(): void
    {
        $otherCompany = Company::factory()->create();
        $otherWarehouse = Warehouse::factory()->create(['company_id' => $otherCompany->id]);
        $otherUser = User::factory()->create(['company_id' => $otherCompany->id]);

        $role = Role::create([
            'name' => 'System Admin Other',
            'slug' => 'sysadmin-other',
            'is_system' => true,
        ]);
        $otherUser->roles()->attach($role->id);

        $flags = app(FeatureFlagService::class);
        $flags->enable('modules.preparation_os', $otherCompany->id);
        $flags->enable('workflow.stages.preparation', $otherCompany->id);

        $wave = $this->makeWave();

        $this->actingAs($otherUser)
            ->getJson($this->waveApiPath($wave->id))
            ->assertStatus(404);
    }

    // ── 12. Timeline API endpoint ─────────────────────────────────────────────

    public function test_timeline_endpoint_returns_entries(): void
    {
        $wave = $this->makeWave(WaveStatus::Draft);

        // Write a timeline entry directly
        app(\App\Core\Timeline\TimelineService::class)->record(
            companyId: $this->company->id,
            subjectType: 'PreparationWave',
            subjectId: $wave->id,
            eventType: 'wave.created',
            title: 'Wave created',
            sourceModule: 'Operations.Preparation',
        );

        $this->actingAs($this->user)
            ->getJson($this->waveApiPath($wave->id, 'timeline'))
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'id',
                        'event_type',
                        'title',
                        'occurred_at',
                    ],
                ],
            ])
            ->assertJsonCount(1, 'data');
    }

    // ── 13. Documents API endpoint ────────────────────────────────────────────

    public function test_documents_endpoint_returns_empty_array(): void
    {
        $wave = $this->makeWave(WaveStatus::Draft);

        $this->actingAs($this->user)
            ->getJson($this->waveApiPath($wave->id, 'documents'))
            ->assertOk()
            ->assertJsonPath('data', []);
    }
}
