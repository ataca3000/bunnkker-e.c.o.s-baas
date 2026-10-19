<?php

declare(strict_types=1);

namespace Tests\Feature\Operations;

use App\Core\FeatureFlags\FeatureFlagService;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Operations\Preparation\Application\Actions\CreateWaveAction;
use Modules\Operations\Preparation\Application\Actions\RecalculateWaveAction;
use Modules\Operations\Preparation\Application\DTOs\CreateWaveDTO;
use Modules\Operations\Preparation\Application\DTOs\RecalculateWaveDTO;
use Modules\Operations\Preparation\Domain\Exceptions\OrderAlreadyInWaveException;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;
use Modules\Operations\Preparation\Domain\Models\PreparationWaveOrder;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

class OrderExclusivityTest extends TestCase
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

    private function orderLine(?string $orderId = null): array
    {
        return [
            'order_id' => $orderId ?? Str::uuid()->toString(),
            'order_number' => 'ORD-'.rand(1000, 9999),
            'confirmed_at' => now()->toDateTimeString(),
        ];
    }

    private function makeDto(array $orderLines): CreateWaveDTO
    {
        return new CreateWaveDTO(
            companyId: $this->company->id,
            warehouseId: $this->warehouse->id,
            planningDate: now()->toDateString(),
            orderLines: $orderLines,
            actorId: (string) $this->user->id,
        );
    }

    public function test_create_wave_succeeds_with_unique_orders(): void
    {
        $line = $this->orderLine();
        $wave = app(CreateWaveAction::class)->execute($this->makeDto([$line]));

        $this->assertDatabaseHas('preparation_wave_orders', [
            'order_id' => $line['order_id'],
            'preparation_wave_id' => $wave->id,
        ]);
    }

    public function test_create_wave_fails_if_order_already_in_another_wave(): void
    {
        $this->expectException(OrderAlreadyInWaveException::class);

        $line = $this->orderLine();

        // First wave — succeeds
        app(CreateWaveAction::class)->execute($this->makeDto([$line]));

        // Second wave with same order — must fail
        app(CreateWaveAction::class)->execute($this->makeDto([$line]));
    }

    public function test_duplicate_order_exception_contains_conflicting_order_ids(): void
    {
        $line = $this->orderLine();
        app(CreateWaveAction::class)->execute($this->makeDto([$line]));

        try {
            app(CreateWaveAction::class)->execute($this->makeDto([$line]));
            $this->fail('Expected OrderAlreadyInWaveException was not thrown.');
        } catch (OrderAlreadyInWaveException $e) {
            $this->assertContains($line['order_id'], $e->orderIds);
        }
    }

    public function test_recalculate_wave_fails_if_added_order_belongs_to_other_wave(): void
    {
        $this->expectException(OrderAlreadyInWaveException::class);

        $sharedOrder = $this->orderLine();

        // First wave claims the order
        app(CreateWaveAction::class)->execute($this->makeDto([$sharedOrder]));

        // Second wave with a different order
        $wave2 = app(CreateWaveAction::class)->execute($this->makeDto([$this->orderLine()]));

        // Try to add the claimed order to the second wave
        $dto = new RecalculateWaveDTO(
            actorId: (string) $this->user->id,
            addOrderLines: [$sharedOrder],
        );

        app(RecalculateWaveAction::class)->execute($wave2, $dto);
    }

    public function test_recalculate_wave_allows_re_adding_own_orders(): void
    {
        $line1 = $this->orderLine();
        $line2 = $this->orderLine();
        $wave = app(CreateWaveAction::class)->execute($this->makeDto([$line1, $line2]));

        // Re-adding line1 (already in the same wave) must not throw
        $dto = new RecalculateWaveDTO(
            actorId: (string) $this->user->id,
            addOrderLines: [$line1],
        );

        $result = app(RecalculateWaveAction::class)->execute($wave, $dto);
        $this->assertNotNull($result);
    }

    public function test_db_unique_constraint_prevents_duplicate_company_order_pair(): void
    {
        $orderId = Str::uuid()->toString();
        $wave = PreparationWave::create([
            'company_id' => $this->company->id,
            'warehouse_id' => $this->warehouse->id,
            'wave_number' => 'PREP-'.now()->format('Ym').'-000001',
            'planning_date' => now()->addDay()->toDateString(),
            'status' => 'draft',
            'orders_count' => 0,
            'products_count' => 0,
            'lines_count' => 0,
            'total_units_required' => 0,
            'total_units_prepared' => 0,
            'shortage_detected' => false,
            'created_by' => (string) $this->user->id,
            'updated_by' => (string) $this->user->id,
        ]);

        PreparationWaveOrder::create([
            'company_id' => $this->company->id,
            'preparation_wave_id' => $wave->id,
            'order_id' => $orderId,
            'order_number' => 'ORD-001',
            'added_by' => (string) $this->user->id,
        ]);

        $this->expectException(\Illuminate\Database\QueryException::class);

        // Same company_id + order_id — must violate the unique constraint
        PreparationWaveOrder::create([
            'company_id' => $this->company->id,
            'preparation_wave_id' => $wave->id,
            'order_id' => $orderId,
            'order_number' => 'ORD-001-DUP',
            'added_by' => (string) $this->user->id,
        ]);
    }
}
