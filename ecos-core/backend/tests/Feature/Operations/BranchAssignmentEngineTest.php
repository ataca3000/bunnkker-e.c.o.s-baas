<?php

declare(strict_types=1);

namespace Tests\Feature\Operations;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Modules\Admin\Configuration\Domain\Models\MasterGovernorate;
use Modules\Admin\Configuration\Domain\Models\MasterZone;
use Modules\Commerce\Orders\Application\Actions\ReserveOrderInventoryAction;
use Modules\Commerce\Orders\Domain\Enums\ReservationStatus;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Orders\Domain\Models\OrderLine;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Operations\Preparation\Application\Services\BranchAssignmentEngine;
use Modules\Operations\Preparation\Domain\Enums\WarehouseAssignmentSource;
use Modules\Organization\Branches\Domain\Models\Branch;
use Modules\Organization\Branches\Domain\Models\BranchCoverageArea;
use Modules\Organization\Companies\Domain\Models\Company;
use Modules\Sales\Customers\Domain\Models\Customer;
use Tests\TestCase;

/**
 * TASK-BRANCH-ASSIGNMENT-ENGINE-001 — Integration test suite.
 *
 * Scenarios:
 *   A — Single branch covers area → assigned, warehouse populated
 *   B — Two branches cover area → nearest branch selected (by Haversine)
 *   C — No branch covers area → NoBranchCoverage signal, order NOT set to AwaitingStock
 *   D — After assignment, ReserveOrderInventoryAction executes → Reserved → Preparing path opens
 */
class BranchAssignmentEngineTest extends TestCase
{
    use DatabaseTransactions;

    private Company $company;

    private MasterGovernorate $governorate;

    private MasterZone $zone;

    private Warehouse $warehouse;

    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company     = Company::factory()->create();
        $this->warehouse   = Warehouse::factory()->create(['company_id' => $this->company->id]);
        $this->customer    = Customer::factory()->create();
        $this->governorate = MasterGovernorate::create([
            'name'      => 'Cairo',
            'name_ar'   => 'القاهرة',
            'code'      => 'C' . substr(uniqid(), -7),
            'is_active' => true,
        ]);
        $this->zone = MasterZone::create([
            'master_governorate_id' => $this->governorate->id,
            'name'                  => 'Nasr City',
            'code'                  => 'NC' . substr(uniqid(), -8),
            'is_active'             => true,
        ]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeOrder(string $governorate = 'Cairo', ?string $area = null, ?float $lat = null, ?float $lng = null): Order
    {
        return Order::query()->create([
            'company_id'          => $this->company->id,
            'customer_id'         => $this->customer->id,
            'order_number'        => 'ORD-BAE-' . uniqid(),
            'order_date'          => now()->toDateString(),
            'status'              => 'in_progress',
            'subtotal'            => 0,
            'total'               => 0,
            'shipping_total'      => 0,
            'discount_total'      => 0,
            'tax_total'           => 0,
            'governorate'         => $governorate,
            'area'                => $area,
            'google_maps_lat'     => $lat,
            'google_maps_lng'     => $lng,
        ]);
    }

    private function makeBranch(float $lat = 30.0, float $lng = 31.0): Branch
    {
        return Branch::create([
            'company_id'          => $this->company->id,
            'code'                => 'BR-' . uniqid(),
            'name'                => 'Test Branch ' . uniqid(),
            'is_active'           => true,
            'default_warehouse_id' => $this->warehouse->id,
            'latitude'            => $lat,
            'longitude'           => $lng,
        ]);
    }

    private function coverGovernorate(Branch $branch, int $priority = 100): BranchCoverageArea
    {
        return BranchCoverageArea::create([
            'branch_id'             => $branch->id,
            'master_governorate_id' => $this->governorate->id,
            'master_zone_id'        => null,
            'priority'              => $priority,
            'is_active'             => true,
        ]);
    }

    private function coverZone(Branch $branch, int $priority = 100): BranchCoverageArea
    {
        return BranchCoverageArea::create([
            'branch_id'             => $branch->id,
            'master_governorate_id' => $this->governorate->id,
            'master_zone_id'        => $this->zone->id,
            'priority'              => $priority,
            'is_active'             => true,
        ]);
    }

    // ── Scenario A ────────────────────────────────────────────────────────────

    /**
     * Single branch covers the order's governorate.
     * Engine must assign that branch and populate assigned_warehouse_id.
     */
    public function test_single_branch_covering_area_is_assigned(): void
    {
        $branch = $this->makeBranch();
        $this->coverGovernorate($branch);

        $order = $this->makeOrder(governorate: 'Cairo');

        app(BranchAssignmentEngine::class)->assign($order, $this->company->id);

        $order->refresh();

        $this->assertSame($branch->id, $order->assigned_branch_id);
        $this->assertSame($this->warehouse->id, $order->assigned_warehouse_id);
        $this->assertSame(WarehouseAssignmentSource::BranchCoverage->value, $order->warehouse_assignment_source);
        $this->assertNull($order->warehouse_assignment_failure_reason);
        $this->assertNotNull($order->warehouse_assigned_at);
    }

    // ── Scenario B ────────────────────────────────────────────────────────────

    /**
     * Two branches cover the same governorate.
     * When the order has GPS coordinates, the nearest branch is selected (Haversine).
     *
     * Order is at (30.0, 31.3).
     * Branch A is at (30.0, 31.0) → distance ≈ 29 km.
     * Branch B is at (30.0, 32.0) → distance ≈ 78 km.
     * Branch A is nearer → must be assigned.
     */
    public function test_nearest_branch_selected_when_multiple_cover_area(): void
    {
        // Branch A — nearer (same governorate, priority 100)
        $warehouseA = Warehouse::factory()->create(['company_id' => $this->company->id]);
        $branchA    = Branch::create([
            'company_id'           => $this->company->id,
            'code'                 => 'BR-A-' . uniqid(),
            'name'                 => 'Branch A',
            'is_active'            => true,
            'default_warehouse_id' => $warehouseA->id,
            'latitude'             => 30.0,
            'longitude'            => 31.0,
        ]);
        $this->coverGovernorate($branchA, priority: 100);

        // Branch B — farther (same governorate, priority 100)
        $warehouseB = Warehouse::factory()->create(['company_id' => $this->company->id]);
        $branchB    = Branch::create([
            'company_id'           => $this->company->id,
            'code'                 => 'BR-B-' . uniqid(),
            'name'                 => 'Branch B',
            'is_active'            => true,
            'default_warehouse_id' => $warehouseB->id,
            'latitude'             => 30.0,
            'longitude'            => 32.0,
        ]);
        $this->coverGovernorate($branchB, priority: 100);

        // Order GPS is close to Branch A
        $order = $this->makeOrder(governorate: 'Cairo', lat: 30.0, lng: 31.3);

        app(BranchAssignmentEngine::class)->assign($order, $this->company->id);

        $order->refresh();

        $this->assertSame($branchA->id, $order->assigned_branch_id, 'Nearest branch (A) should be selected');
        $this->assertSame($warehouseA->id, $order->assigned_warehouse_id);
        $this->assertSame(WarehouseAssignmentSource::BranchCoverage->value, $order->warehouse_assignment_source);
    }

    // ── Scenario C ────────────────────────────────────────────────────────────

    /**
     * No branch covers the order's governorate.
     * Engine must set warehouse_assignment_source = no_branch_coverage.
     * Order status must NOT be set to awaiting_stock — this is an Operations problem.
     */
    public function test_no_branch_coverage_sets_failure_signal_not_awaiting_stock(): void
    {
        // Deliberately do NOT create any BranchCoverageArea for Cairo.
        $order = $this->makeOrder(governorate: 'Cairo');
        $initialStatus = $order->status->value;

        app(BranchAssignmentEngine::class)->assign($order, $this->company->id);

        $order->refresh();

        $this->assertNull($order->assigned_branch_id);
        $this->assertNull($order->assigned_warehouse_id);
        $this->assertSame(WarehouseAssignmentSource::NoBranchCoverage->value, $order->warehouse_assignment_source);
        $this->assertSame('No Branch Covers Destination', $order->warehouse_assignment_failure_reason);

        // CRITICAL: order status must not become awaiting_stock
        $this->assertSame($initialStatus, $order->status->value,
            'Order status must not change to awaiting_stock when no branch covers the area');
    }

    // ── Scenario D ────────────────────────────────────────────────────────────

    /**
     * After BranchAssignmentEngine assigns a warehouse, ReserveOrderInventoryAction
     * can execute successfully and returns Reserved — proving the full pipeline is unblocked.
     */
    public function test_assigned_warehouse_enables_reservation(): void
    {
        $branch = $this->makeBranch();
        $this->coverGovernorate($branch);

        // Seed sufficient FG stock
        $product = Product::factory()->create([
            'allow_negative_stock' => false,
            'company_id'           => $this->company->id,
        ]);
        InventoryItem::query()->create([
            'warehouse_id' => $this->warehouse->id,
            'product_id'   => $product->id,
            'company_id'   => $this->company->id,
            'on_hand_qty'  => 20.0,
            'reserved_qty' => 0.0,
        ]);

        $order = $this->makeOrder(governorate: 'Cairo');

        // Step 1: assign branch + warehouse
        app(BranchAssignmentEngine::class)->assign($order, $this->company->id);
        $order->refresh();

        $this->assertNotNull($order->assigned_warehouse_id, 'Warehouse must be assigned before reservation');

        // Step 2: add order line
        OrderLine::query()->create([
            'order_id'   => $order->id,
            'product_id' => $product->id,
            'quantity'   => 5.0,
            'unit_price' => 100.0,
            'line_total' => 500.0,
        ]);

        // Step 3: execute reservation
        $status = app(ReserveOrderInventoryAction::class)->execute($order->fresh());

        $this->assertSame(ReservationStatus::Reserved, $status);

        $order->refresh();
        $this->assertSame(ReservationStatus::Reserved->value, $order->reservation_status->value);
    }
}
