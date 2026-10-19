<?php

declare(strict_types=1);

namespace Tests\Feature\Commerce;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;
use Mockery;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Commerce\ProductMappings\Domain\Models\ProductMapping;
use Modules\Commerce\Synchronization\Application\Jobs\InventorySyncJob;
use Modules\Commerce\Synchronization\Application\Listeners\InventoryChannelSynchronizationListener;
use Modules\Commerce\Synchronization\Application\Services\ChannelSynchronizationService;
use Modules\Inventory\DomainEvents\Events\InventoryCountApproved;
use Modules\Inventory\DomainEvents\Events\InventoryStockAdjusted;
use Modules\Inventory\DomainEvents\Events\InventoryStockReceived;
use Modules\Inventory\Products\Domain\Enums\InventoryClass;
use Modules\Inventory\DomainEvents\Events\InventoryStockReleased;
use Modules\Inventory\DomainEvents\Events\InventoryStockReserved;
use Modules\Inventory\DomainEvents\Events\InventoryStockShipped;
use Modules\Inventory\InventoryItems\Application\Actions\ReceiveStockAction;
use Modules\Inventory\InventoryItems\Application\DTO\StockOperationDTO;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Inventory\StockLedger\Domain\Enums\MovementType;
use Modules\Inventory\StockLedger\Domain\Models\StockMovement;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Brands\Domain\Models\Brand;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * TASK-IMPLEMENT-002 Phase B — Channel Synchronization Dual Run
 *
 * Verifies:
 *  1. Listener delegates to ChannelSynchronizationService (no logic in listener)
 *  2. Service dispatches InventorySyncJob for active channels with stock-sync mapping
 *  3. Service does NOT dispatch for unmapped products
 *  4. Service does NOT dispatch for inactive channels
 *  5. Service does NOT dispatch when sync_stock = false
 *  6. Service dispatches one job per channel when multiple mappings exist
 *  7. Correlation ID and event metadata appear in the structured log
 *  8. All 6 domain events expose eventVersion() = 1
 *  9. InventoryCountApproved (session-level, no product_id) is handled gracefully
 * 10. StockMovementObserver is unchanged and still dispatches InventorySyncJob (legacy path)
 * 11. Dual-run: domain-event pipeline and legacy observer are both active simultaneously
 */
class ChannelSynchronizationDualRunTest extends TestCase
{
    use RefreshDatabase;

    private Company $company;

    private Brand $brand;

    private Warehouse $warehouse;

    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->brand = Brand::factory()->create(['company_id' => $this->company->id]);
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);
        $this->product = Product::factory()->create();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function dto(float $quantity): StockOperationDTO
    {
        return StockOperationDTO::fromArray([
            'warehouse_id' => $this->warehouse->id,
            'product_id' => $this->product->id,
            'company_id' => $this->company->id,
            'quantity' => $quantity,
            'reference_type' => 'test',
            'reference_id' => 'dual-run-ref',
        ]);
    }

    private function activeChannel(): Channel
    {
        return Channel::factory()->create([
            'brand_id' => $this->brand->id,
            'is_active' => true,
            'sync_stock' => true,
        ]);
    }

    private function mapProduct(Channel $channel): ProductMapping
    {
        return ProductMapping::factory()->create([
            'product_id' => $this->product->id,
            'channel_id' => $channel->id,
        ]);
    }

    private function receivedEvent(): InventoryStockReceived
    {
        return new InventoryStockReceived(
            inventoryItemId: 'item-uuid',
            warehouseId: $this->warehouse->id,
            productId: $this->product->id,
            companyId: $this->company->id,
            quantityReceived: 10.0,
            onHandBefore: 0.0,
            onHandAfter: 10.0,
            inventoryClass: InventoryClass::FinishedGood,
            unitCost: 1.0,
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Part 1 — Listener delegates to ChannelSynchronizationService
    // ─────────────────────────────────────────────────────────────────────────

    public function test_listener_delegates_to_service_not_logging_only(): void
    {
        $service = $this->mock(ChannelSynchronizationService::class);
        $service->shouldReceive('handleEvent')
            ->once()
            ->with(Mockery::type(InventoryStockReceived::class));

        app(InventoryChannelSynchronizationListener::class)->handle($this->receivedEvent());
    }

    public function test_listener_does_not_contain_dispatch_logic_itself(): void
    {
        // Intercept the service so it does nothing. Then verify no job is pushed
        // by the LISTENER itself — all dispatching belongs to the service.
        Queue::fake();

        $this->mock(ChannelSynchronizationService::class)
            ->shouldReceive('handleEvent')
            ->once()
            ->andReturnNull();

        app(InventoryChannelSynchronizationListener::class)->handle($this->receivedEvent());

        Queue::assertNothingPushed();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Part 2 — Service dispatches InventorySyncJob for eligible channels
    // ─────────────────────────────────────────────────────────────────────────

    public function test_service_dispatches_sync_job_for_active_channel_with_mapping(): void
    {
        Queue::fake();

        $channel = $this->activeChannel();
        $this->mapProduct($channel);

        app(ChannelSynchronizationService::class)->handleEvent($this->receivedEvent());

        Queue::assertPushed(InventorySyncJob::class, 1);
    }

    public function test_service_does_not_dispatch_when_no_product_mapping_exists(): void
    {
        Queue::fake();

        // Active channel exists but no ProductMapping for this product.
        Channel::factory()->create([
            'brand_id' => $this->brand->id,
            'is_active' => true,
            'sync_stock' => true,
        ]);

        app(ChannelSynchronizationService::class)->handleEvent($this->receivedEvent());

        Queue::assertNothingPushed();
    }

    public function test_service_does_not_dispatch_when_channel_is_inactive(): void
    {
        Queue::fake();

        $channel = Channel::factory()->create([
            'brand_id' => $this->brand->id,
            'is_active' => false,
            'sync_stock' => true,
        ]);
        $this->mapProduct($channel);

        app(ChannelSynchronizationService::class)->handleEvent($this->receivedEvent());

        Queue::assertNothingPushed();
    }

    public function test_service_does_not_dispatch_when_sync_stock_is_disabled(): void
    {
        Queue::fake();

        $channel = Channel::factory()->create([
            'brand_id' => $this->brand->id,
            'is_active' => true,
            'sync_stock' => false,
        ]);
        $this->mapProduct($channel);

        app(ChannelSynchronizationService::class)->handleEvent($this->receivedEvent());

        Queue::assertNothingPushed();
    }

    public function test_service_dispatches_one_job_per_active_channel_mapping(): void
    {
        Queue::fake();

        $channel1 = $this->activeChannel();
        $channel2 = $this->activeChannel();
        $this->mapProduct($channel1);
        $this->mapProduct($channel2);

        app(ChannelSynchronizationService::class)->handleEvent($this->receivedEvent());

        Queue::assertPushed(InventorySyncJob::class, 2);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Part 3 — Correlation ID and event metadata propagated to structured log
    // ─────────────────────────────────────────────────────────────────────────

    public function test_correlation_id_and_event_name_appear_in_service_structured_log(): void
    {
        Queue::fake();

        $channel = $this->activeChannel();
        $this->mapProduct($channel);

        $loggedContext = null;
        Log::listen(function ($log) use (&$loggedContext): void {
            if (str_contains($log->message, '[ChannelSync] Event processed')) {
                $loggedContext = $log->context;
            }
        });

        $event = $this->receivedEvent();
        app(ChannelSynchronizationService::class)->handleEvent($event);

        $this->assertNotNull($loggedContext, 'Service must log "[ChannelSync] Event processed".');
        $this->assertSame($event->correlationId(), $loggedContext['correlation_id']);
        $this->assertSame($event->eventName(), $loggedContext['event_name']);
        $this->assertSame($event->eventVersion(), $loggedContext['event_version']);
        $this->assertSame($this->product->id, $loggedContext['product_id']);
        $this->assertSame(1, $loggedContext['jobs_dispatched']);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Part 4 — All 6 domain events must expose eventVersion() = 1
    // ─────────────────────────────────────────────────────────────────────────

    public function test_all_six_domain_events_expose_version_1(): void
    {
        $w = $this->warehouse->id;
        $p = $this->product->id;
        $c = $this->company->id;
        $i = 'item-uuid';

        $events = [
            new InventoryStockReceived($i, $w, $p, $c, 10.0, 0.0, 10.0, InventoryClass::FinishedGood, 1.0),
            new InventoryStockReserved($i, $w, $p, $c, 5.0, 0.0, 5.0, 10.0),
            new InventoryStockReleased($i, $w, $p, $c, 5.0, 5.0, 0.0, 10.0),
            new InventoryStockShipped($i, $w, $p, $c, 5.0, 10.0, 5.0, 0.0, 0.0, InventoryClass::FinishedGood, 1.0),
            new InventoryStockAdjusted($i, $w, $p, $c, InventoryStockAdjusted::TYPE_IN, 3.0, 5.0, 8.0, InventoryClass::FinishedGood, 1.0),
            new InventoryCountApproved('session-uuid', 'CNT-001', $w, $c, 1),
        ];

        foreach ($events as $event) {
            $this->assertSame(
                1,
                $event->eventVersion(),
                sprintf('%s must return eventVersion() = 1', $event->eventName()),
            );
        }
    }

    public function test_all_six_domain_events_expose_correlation_id_equal_to_event_id(): void
    {
        $w = $this->warehouse->id;
        $p = $this->product->id;
        $c = $this->company->id;
        $i = 'item-uuid';

        $events = [
            new InventoryStockReceived($i, $w, $p, $c, 10.0, 0.0, 10.0, InventoryClass::FinishedGood, 1.0),
            new InventoryStockReserved($i, $w, $p, $c, 5.0, 0.0, 5.0, 10.0),
            new InventoryStockReleased($i, $w, $p, $c, 5.0, 5.0, 0.0, 10.0),
            new InventoryStockShipped($i, $w, $p, $c, 5.0, 10.0, 5.0, 0.0, 0.0, InventoryClass::FinishedGood, 1.0),
            new InventoryStockAdjusted($i, $w, $p, $c, InventoryStockAdjusted::TYPE_IN, 3.0, 5.0, 8.0, InventoryClass::FinishedGood, 1.0),
            new InventoryCountApproved('session-uuid', 'CNT-001', $w, $c, 1),
        ];

        foreach ($events as $event) {
            $this->assertSame(
                $event->eventId(),
                $event->correlationId(),
                sprintf('%s::correlationId() must equal eventId() for originating events', $event->eventName()),
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Part 5 — InventoryCountApproved (session-level, no product_id)
    // ─────────────────────────────────────────────────────────────────────────

    public function test_inventory_count_approved_is_handled_gracefully_without_dispatching_job(): void
    {
        Queue::fake();

        // Even with an active channel mapping the service must no-op for session events.
        $channel = $this->activeChannel();
        $this->mapProduct($channel);

        $event = new InventoryCountApproved(
            countSessionId: 'session-uuid-001',
            countNumber: 'CNT-2026-001',
            warehouseId: $this->warehouse->id,
            companyId: $this->company->id,
            linesAdjusted: 3,
        );

        // Must not throw — session events are silently no-op'd by the service.
        app(ChannelSynchronizationService::class)->handleEvent($event);

        Queue::assertNothingPushed();
    }

    public function test_inventory_count_approved_passes_listener_validation(): void
    {
        // InventoryCountApproved has event_id, event_name, occurred_at in its payload.
        // Phase B REQUIRED_FIELDS = ['event_id', 'event_name', 'occurred_at'].
        // The listener must not log a warning — it must delegate to service.
        $service = $this->mock(ChannelSynchronizationService::class);
        $service->shouldReceive('handleEvent')->once();

        $event = new InventoryCountApproved(
            countSessionId: 'session-uuid-002',
            countNumber: 'CNT-2026-002',
            warehouseId: $this->warehouse->id,
            companyId: $this->company->id,
            linesAdjusted: 5,
        );

        app(InventoryChannelSynchronizationListener::class)->handle($event);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Part 6 — Legacy StockMovementObserver unchanged (dual-run guarantee)
    // ─────────────────────────────────────────────────────────────────────────

    public function test_legacy_observer_still_dispatches_sync_job_for_mapped_product(): void
    {
        Queue::fake();

        $channel = $this->activeChannel();
        $this->mapProduct($channel);

        // Direct StockMovement creation triggers the observer's `created` hook.
        // This path is completely independent of the domain event system.
        StockMovement::create([
            'warehouse_id' => $this->warehouse->id,
            'product_id' => $this->product->id,
            'movement_type' => MovementType::PurchaseReceipt->value,
            'quantity' => 20.0,
            'balance_before' => 0.0,
            'balance_after' => 20.0,
            'movement_date' => now()->toDateString(),
        ]);

        Queue::assertPushed(InventorySyncJob::class, 1);
    }

    public function test_legacy_observer_skips_job_for_unmapped_product(): void
    {
        Queue::fake();

        StockMovement::create([
            'warehouse_id' => $this->warehouse->id,
            'product_id' => $this->product->id,
            'movement_type' => MovementType::PurchaseReceipt->value,
            'quantity' => 5.0,
            'balance_before' => 0.0,
            'balance_after' => 5.0,
            'movement_date' => now()->toDateString(),
        ]);

        Queue::assertNothingPushed();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Part 7 — Dual run: both pipelines active simultaneously
    // ─────────────────────────────────────────────────────────────────────────

    public function test_dual_run_both_domain_event_and_observer_pipelines_are_active(): void
    {
        Queue::fake();

        $channel = $this->activeChannel();
        $this->mapProduct($channel);

        // Path A — Domain event pipeline.
        // ReceiveStockAction creates/updates an InventoryItem and publishes InventoryStockReceived.
        // The listener forwards it to ChannelSynchronizationService → dispatches InventorySyncJob.
        app(ReceiveStockAction::class)->execute($this->dto(10.0));

        // Path B — Legacy observer pipeline.
        // Direct StockMovement creation triggers StockMovementObserver → dispatches InventorySyncJob.
        StockMovement::create([
            'warehouse_id' => $this->warehouse->id,
            'product_id' => $this->product->id,
            'movement_type' => MovementType::PurchaseReceipt->value,
            'quantity' => 10.0,
            'balance_before' => 0.0,
            'balance_after' => 10.0,
            'movement_date' => now()->toDateString(),
        ]);

        // Both pipelines must have dispatched a job independently — 2 total.
        // InventorySyncJob is idempotent (absolute PUT to WooCommerce), so duplicate
        // dispatch is safe and expected during the Phase B dual-run period.
        Queue::assertPushed(InventorySyncJob::class, 2);
    }
}
