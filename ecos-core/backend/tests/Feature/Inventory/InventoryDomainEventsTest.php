<?php

declare(strict_types=1);

namespace Tests\Feature\Inventory;

use DateTimeImmutable;
use DateTimeInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;
use Mockery;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Commerce\ProductMappings\Domain\Models\ProductMapping;
use Modules\Commerce\Synchronization\Application\Jobs\InventorySyncJob;
use Modules\Commerce\Synchronization\Application\Listeners\InventoryChannelSynchronizationListener;
use Modules\Commerce\Synchronization\Application\Services\ChannelSynchronizationService;
use Modules\Inventory\DomainEvents\Contracts\DomainEvent;
use Modules\Inventory\DomainEvents\Contracts\DomainEventBus;
use Modules\Inventory\DomainEvents\Events\InventoryCountApproved;
use Modules\Inventory\DomainEvents\Events\InventoryStockAdjusted;
use Modules\Inventory\DomainEvents\Events\InventoryStockReceived;
use Modules\Inventory\Products\Domain\Enums\InventoryClass;
use Modules\Inventory\DomainEvents\Events\InventoryStockReleased;
use Modules\Inventory\DomainEvents\Events\InventoryStockReserved;
use Modules\Inventory\DomainEvents\Events\InventoryStockShipped;
use Modules\Inventory\DomainEvents\Infrastructure\Bus\LaravelDomainEventBus;
use Modules\Inventory\InventoryItems\Application\Actions\AdjustmentInAction;
use Modules\Inventory\InventoryItems\Application\Actions\AdjustmentOutAction;
use Modules\Inventory\InventoryItems\Application\Actions\ReceiveStockAction;
use Modules\Inventory\InventoryItems\Application\Actions\ReleaseStockAction;
use Modules\Inventory\InventoryItems\Application\Actions\ReserveStockAction;
use Modules\Inventory\InventoryItems\Application\Actions\ShipStockAction;
use Modules\Inventory\InventoryItems\Application\DTO\StockOperationDTO;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Inventory\StockLedger\Domain\Enums\MovementType;
use Modules\Inventory\StockLedger\Domain\Models\StockMovement;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Brands\Domain\Models\Brand;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;
use Throwable;

/**
 * TASK-IMPLEMENT-001 Phase A — Inventory Domain Events (Shadow Mode)
 *
 * Verifies:
 *  1. DomainEventBus → LaravelDomainEventBus IoC binding
 *  2. Each inventory action dispatches the correct domain event after commit
 *  3. No event is published when a transaction rolls back
 *  4. InventoryChannelSynchronizationListener logs only — no InventorySyncJob
 *  5. StockMovementObserver is unchanged and still dispatches InventorySyncJob
 *  6. No duplicate sync from the new domain event paths
 */
class InventoryDomainEventsTest extends TestCase
{
    use RefreshDatabase;

    private Company $company;

    private Warehouse $warehouse;

    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);
        $this->product = Product::factory()->create();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function dto(float $quantity, array $overrides = []): StockOperationDTO
    {
        return StockOperationDTO::fromArray(array_merge([
            'warehouse_id' => $this->warehouse->id,
            'product_id' => $this->product->id,
            'company_id' => $this->company->id,
            'quantity' => $quantity,
            'reference_type' => 'test',
            'reference_id' => 'test-ref-001',
            // Upward adjustments must state their value (Decision 2). Supplied
            // here so these tests exercise the movement itself rather than the
            // valuation guard, which has its own tests.
            'unit_cost' => 10.0,
        ], $overrides));
    }

    private function seedStock(float $qty): void
    {
        app(ReceiveStockAction::class)->execute($this->dto($qty));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Part 1 — IoC binding
    // ─────────────────────────────────────────────────────────────────────────

    public function test_domain_event_bus_interface_resolves_to_laravel_implementation(): void
    {
        $bus = app(DomainEventBus::class);

        $this->assertInstanceOf(LaravelDomainEventBus::class, $bus);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Part 2 — Action → Event dispatch (after successful commit)
    // ─────────────────────────────────────────────────────────────────────────

    public function test_receive_stock_action_dispatches_stock_received_event(): void
    {
        Event::fake();

        app(ReceiveStockAction::class)->execute($this->dto(100.0));

        Event::assertDispatched(InventoryStockReceived::class, function (InventoryStockReceived $event): bool {
            return $event->productId === $this->product->id
                && $event->warehouseId === $this->warehouse->id
                && $event->companyId === $this->company->id
                && $event->quantityReceived === 100.0
                && $event->onHandBefore === 0.0
                && $event->onHandAfter === 100.0
                && $event->referenceType === 'test'
                && $event->eventName() === 'inventory.stock.received'
                && strlen($event->eventId()) === 36;
        });
    }

    public function test_reserve_stock_action_dispatches_stock_reserved_event(): void
    {
        $this->seedStock(50.0);

        Event::fake();

        app(ReserveStockAction::class)->execute($this->dto(20.0));

        Event::assertDispatched(InventoryStockReserved::class, function (InventoryStockReserved $event): bool {
            return $event->productId === $this->product->id
                && $event->warehouseId === $this->warehouse->id
                && $event->quantityReserved === 20.0
                && $event->eventName() === 'inventory.stock.reserved';
        });
    }

    public function test_release_stock_action_dispatches_stock_released_event(): void
    {
        $this->seedStock(50.0);
        app(ReserveStockAction::class)->execute($this->dto(20.0));

        Event::fake();

        app(ReleaseStockAction::class)->execute($this->dto(20.0));

        Event::assertDispatched(InventoryStockReleased::class, function (InventoryStockReleased $event): bool {
            return $event->productId === $this->product->id
                && $event->quantityReleased === 20.0
                && $event->eventName() === 'inventory.stock.released';
        });
    }

    public function test_ship_stock_action_dispatches_stock_shipped_event(): void
    {
        $this->seedStock(100.0);
        app(ReserveStockAction::class)->execute($this->dto(30.0));

        Event::fake();

        app(ShipStockAction::class)->execute($this->dto(30.0));

        Event::assertDispatched(InventoryStockShipped::class, function (InventoryStockShipped $event): bool {
            return $event->productId === $this->product->id
                && $event->quantityShipped === 30.0
                && $event->onHandBefore === 100.0
                && $event->onHandAfter === 70.0
                && $event->reservedBefore === 30.0
                && $event->reservedAfter === 0.0
                && $event->eventName() === 'inventory.stock.shipped';
        });
    }

    public function test_adjustment_in_action_dispatches_stock_adjusted_event_type_in(): void
    {
        Event::fake();

        app(AdjustmentInAction::class)->execute($this->dto(15.0));

        Event::assertDispatched(InventoryStockAdjusted::class, function (InventoryStockAdjusted $event): bool {
            return $event->productId === $this->product->id
                && $event->adjustmentType === InventoryStockAdjusted::TYPE_IN
                && $event->quantity === 15.0
                && $event->onHandBefore === 0.0
                && $event->onHandAfter === 15.0
                && $event->eventName() === 'inventory.stock.adjusted';
        });
    }

    public function test_adjustment_out_action_dispatches_stock_adjusted_event_type_out(): void
    {
        $this->seedStock(50.0);

        Event::fake();

        app(AdjustmentOutAction::class)->execute($this->dto(10.0));

        Event::assertDispatched(InventoryStockAdjusted::class, function (InventoryStockAdjusted $event): bool {
            return $event->productId === $this->product->id
                && $event->adjustmentType === InventoryStockAdjusted::TYPE_OUT
                && $event->quantity === 10.0
                && $event->onHandBefore === 50.0
                && $event->onHandAfter === 40.0
                && $event->eventName() === 'inventory.stock.adjusted';
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Part 3 — Post-commit guarantee: no event on rolled-back transaction
    // ─────────────────────────────────────────────────────────────────────────

    public function test_no_event_published_when_transaction_rolls_back(): void
    {
        // AdjustmentOutAction throws InsufficientStockException when stock is insufficient,
        // rolling back the transaction before the event can be published.
        $this->seedStock(5.0);   // seed some stock so the item exists

        Event::fake();

        try {
            // Request more than available — guaranteed to roll back.
            app(AdjustmentOutAction::class)->execute($this->dto(999.0));
        } catch (Throwable) {
            // Expected — InsufficientStockException rolls back the transaction.
        }

        Event::assertNotDispatched(InventoryStockAdjusted::class);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Part 4 — Shadow Mode: listener logs, never dispatches sync job
    // ─────────────────────────────────────────────────────────────────────────

    public function test_listener_delegates_event_to_channel_synchronization_service(): void
    {
        $service = $this->mock(ChannelSynchronizationService::class);
        $service->shouldReceive('handleEvent')
            ->once()
            ->withArgs(fn ($event) => $event instanceof DomainEvent);

        $event = new InventoryStockReceived(
            inventoryItemId: 'item-uuid',
            warehouseId: $this->warehouse->id,
            productId: $this->product->id,
            companyId: $this->company->id,
            quantityReceived: 100.0,
            onHandBefore: 0.0,
            onHandAfter: 100.0,
            inventoryClass: InventoryClass::FinishedGood,
            unitCost: 1.0,
        );

        app(InventoryChannelSynchronizationListener::class)->handle($event);
    }

    public function test_listener_does_not_dispatch_inventory_sync_job(): void
    {
        Queue::fake();

        // Prevent Log::channel('daily')->info() from failing when Queue::fake replaces the dispatcher.
        Log::shouldReceive('channel')->with('daily')->andReturn(Mockery::mock(\Psr\Log\LoggerInterface::class, [
            'info' => null,
            'warning' => null,
        ]));

        $event = new InventoryStockReceived(
            inventoryItemId: 'item-uuid',
            warehouseId: $this->warehouse->id,
            productId: $this->product->id,
            companyId: $this->company->id,
            quantityReceived: 50.0,
            onHandBefore: 0.0,
            onHandAfter: 50.0,
            inventoryClass: InventoryClass::FinishedGood,
            unitCost: 1.0,
        );

        app(InventoryChannelSynchronizationListener::class)->handle($event);

        Queue::assertNotPushed(InventorySyncJob::class);
    }

    public function test_listener_logs_warning_for_event_missing_base_required_fields(): void
    {
        $channel = Mockery::mock(\Psr\Log\LoggerInterface::class);
        $channel->shouldReceive('warning')
            ->once()
            ->withArgs(function (string $message, array $context): bool {
                // Phase B REQUIRED_FIELDS = ['event_id', 'event_name', 'occurred_at'].
                return str_contains($message, '[DomainEvent][PhaseB]')
                    && str_contains($message, 'missing required fields')
                    && isset($context['missing_fields'])
                    && count($context['missing_fields']) > 0;
            });

        Log::shouldReceive('channel')->with('daily')->once()->andReturn($channel);

        // A stub that omits all three base required fields (event_id, event_name, occurred_at).
        $malformed = new class implements DomainEvent
        {
            public function eventId(): string
            {
                return '';
            }

            public function eventName(): string
            {
                return '';
            }

            public function eventVersion(): int
            {
                return 1;
            }

            public function correlationId(): string
            {
                return '';
            }

            public function occurredAt(): DateTimeImmutable
            {
                return new DateTimeImmutable;
            }

            public function toArray(): array
            {
                return [
                    // event_id, event_name, occurred_at intentionally omitted
                    'version' => 1,
                ];
            }
        };

        app(InventoryChannelSynchronizationListener::class)->handle($malformed);
    }

    public function test_all_six_event_types_are_handled_by_listener_without_error(): void
    {
        // Mock service to avoid real DB queries. Mockery verifies the call count at tearDown.
        $service = $this->mock(ChannelSynchronizationService::class);
        $service->shouldReceive('handleEvent')->times(6);

        $w = $this->warehouse->id;
        $p = $this->product->id;
        $c = $this->company->id;
        $i = 'item-uuid-test';

        $events = [
            new InventoryStockReceived($i, $w, $p, $c, 10.0, 0.0, 10.0, InventoryClass::FinishedGood, 1.0),
            new InventoryStockReserved($i, $w, $p, $c, 5.0, 0.0, 5.0, 10.0),
            new InventoryStockReleased($i, $w, $p, $c, 5.0, 5.0, 0.0, 10.0),
            new InventoryStockShipped($i, $w, $p, $c, 5.0, 10.0, 5.0, 0.0, 0.0, InventoryClass::FinishedGood, 1.0),
            new InventoryStockAdjusted($i, $w, $p, $c, InventoryStockAdjusted::TYPE_IN, 3.0, 5.0, 8.0, InventoryClass::FinishedGood, 1.0),
            new InventoryCountApproved('session-uuid', 'CNT-001', $w, $c, 1),
        ];

        $listener = app(InventoryChannelSynchronizationListener::class);
        foreach ($events as $event) {
            $listener->handle($event);
        }

        // All 6 events have the base required fields (event_id, event_name, occurred_at),
        // so the listener delegates all of them to the service without error.
        $this->assertCount(6, $events);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Part 5 — StockMovementObserver unchanged
    // ─────────────────────────────────────────────────────────────────────────

    public function test_stock_movement_observer_still_dispatches_sync_job_for_mapped_product(): void
    {
        Queue::fake();

        // Wire up a product with an active channel mapping that has sync_stock enabled.
        $brand = Brand::factory()->create(['company_id' => $this->company->id]);
        $channel = Channel::factory()->create([
            'brand_id' => $brand->id,
            'is_active' => true,
            'sync_stock' => true,
        ]);

        ProductMapping::factory()->create([
            'product_id' => $this->product->id,
            'channel_id' => $channel->id,
        ]);

        // Creating a StockMovement directly triggers the observer's `created` hook.
        StockMovement::create([
            'warehouse_id' => $this->warehouse->id,
            'product_id' => $this->product->id,
            'movement_type' => MovementType::PurchaseReceipt->value,
            'quantity' => 10.0,
            'balance_before' => 0.0,
            'balance_after' => 10.0,
            'movement_date' => now()->toDateString(),
        ]);

        Queue::assertPushed(InventorySyncJob::class);
    }

    public function test_stock_movement_observer_skips_sync_for_unmapped_product(): void
    {
        Queue::fake();

        // No ProductMapping for this product → observer returns early.
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
    // Part 6 — Domain event payload integrity
    // ─────────────────────────────────────────────────────────────────────────

    public function test_domain_event_payload_contains_all_required_fields(): void
    {
        Event::fake();

        app(ReceiveStockAction::class)->execute($this->dto(25.0));

        Event::assertDispatched(InventoryStockReceived::class, function (InventoryStockReceived $event): bool {
            $payload = $event->toArray();

            foreach (['event_id', 'event_name', 'occurred_at', 'product_id', 'warehouse_id', 'company_id'] as $field) {
                if (empty($payload[$field])) {
                    return false;
                }
            }

            // occurred_at must be a valid ISO-8601 string
            return (bool) DateTimeImmutable::createFromFormat(DateTimeInterface::ATOM, $payload['occurred_at']);
        });
    }

    public function test_each_domain_event_has_unique_event_id(): void
    {
        Event::fake();

        app(ReceiveStockAction::class)->execute($this->dto(10.0));
        app(AdjustmentInAction::class)->execute($this->dto(5.0));

        $ids = [];
        Event::assertDispatched(InventoryStockReceived::class, function (InventoryStockReceived $e) use (&$ids): bool {
            $ids[] = $e->eventId();

            return true;
        });
        Event::assertDispatched(InventoryStockAdjusted::class, function (InventoryStockAdjusted $e) use (&$ids): bool {
            $ids[] = $e->eventId();

            return true;
        });

        $this->assertCount(2, array_unique($ids), 'Each event must have a unique eventId.');
    }
}
