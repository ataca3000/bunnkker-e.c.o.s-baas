<?php

declare(strict_types=1);

namespace Tests\Feature\Inventory;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Inventory\InventoryItems\Application\Actions\DirectIssueStockAction;
use Modules\Inventory\InventoryItems\Application\Actions\ReceiveStockAction;
use Modules\Inventory\InventoryItems\Application\Actions\ReleaseStockAction;
use Modules\Inventory\InventoryItems\Application\Actions\ReserveStockAction;
use Modules\Inventory\InventoryItems\Application\Actions\ShipStockAction;
use Modules\Inventory\InventoryItems\Application\DTO\StockOperationDTO;
use Modules\Inventory\InventoryItems\Domain\Enums\LedgerMovementType;
use Modules\Inventory\InventoryItems\Domain\Exceptions\InsufficientStockException;
use Modules\Inventory\InventoryItems\Domain\Exceptions\InvalidInventoryMovementException;
use Modules\Inventory\InventoryItems\Domain\Exceptions\NegativeInventoryException;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\InventoryItems\Domain\Models\StockLedgerEntry;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

class InventoryReservationTest extends TestCase
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

    private function dto(float $quantity, array $overrides = []): StockOperationDTO
    {
        return StockOperationDTO::fromArray(array_merge([
            'warehouse_id' => $this->warehouse->id,
            'product_id' => $this->product->id,
            'company_id' => $this->company->id,
            'quantity' => $quantity,
        ], $overrides));
    }

    // -------------------------------------------------------------------------
    // Receive
    // -------------------------------------------------------------------------

    public function test_receive_stock_creates_inventory_item_and_ledger_entry(): void
    {
        $result = app(ReceiveStockAction::class)->execute($this->dto(100.0));

        $this->assertTrue($result->isSuccess());

        $item = InventoryItem::query()
            ->where('warehouse_id', $this->warehouse->id)
            ->where('product_id', $this->product->id)
            ->firstOrFail();

        $this->assertEquals('100.0000', $item->on_hand_qty);
        $this->assertEquals('0.0000', $item->reserved_qty);

        $entry = StockLedgerEntry::query()->where('inventory_item_id', $item->id)->firstOrFail();
        $this->assertEquals(LedgerMovementType::PurchaseReceipt->value, $entry->movement_type->value);
        $this->assertEquals('100.0000', $entry->quantity);
        $this->assertEquals('0.0000', $entry->on_hand_before);
        $this->assertEquals('100.0000', $entry->on_hand_after);
    }

    // -------------------------------------------------------------------------
    // Reserve
    // -------------------------------------------------------------------------

    public function test_reserve_stock_increases_reserved_qty_and_decreases_availability(): void
    {
        app(ReceiveStockAction::class)->execute($this->dto(50.0));

        $result = app(ReserveStockAction::class)->execute($this->dto(20.0));

        $this->assertTrue($result->isSuccess());

        $item = InventoryItem::query()
            ->where('warehouse_id', $this->warehouse->id)
            ->where('product_id', $this->product->id)
            ->firstOrFail();

        $this->assertEquals('50.0000', $item->on_hand_qty);
        $this->assertEquals('20.0000', $item->reserved_qty);
        $this->assertEquals(30.0, $item->availableQty());
    }

    public function test_reserve_stock_throws_insufficient_stock_exception(): void
    {
        app(ReceiveStockAction::class)->execute($this->dto(10.0));

        $this->expectException(InsufficientStockException::class);

        app(ReserveStockAction::class)->execute($this->dto(50.0));
    }

    // -------------------------------------------------------------------------
    // Release
    // -------------------------------------------------------------------------

    public function test_release_stock_restores_available_qty(): void
    {
        app(ReceiveStockAction::class)->execute($this->dto(50.0));
        app(ReserveStockAction::class)->execute($this->dto(20.0));

        $result = app(ReleaseStockAction::class)->execute($this->dto(20.0));

        $this->assertTrue($result->isSuccess());

        $item = InventoryItem::query()
            ->where('warehouse_id', $this->warehouse->id)
            ->where('product_id', $this->product->id)
            ->firstOrFail();

        $this->assertEquals('50.0000', $item->on_hand_qty);
        $this->assertEquals('0.0000', $item->reserved_qty);
        $this->assertEquals(50.0, $item->availableQty());
    }

    public function test_release_more_than_reserved_throws_negative_inventory_exception(): void
    {
        app(ReceiveStockAction::class)->execute($this->dto(50.0));
        app(ReserveStockAction::class)->execute($this->dto(10.0));

        $this->expectException(NegativeInventoryException::class);

        app(ReleaseStockAction::class)->execute($this->dto(20.0));
    }

    // -------------------------------------------------------------------------
    // Ship (requires prior reservation)
    // -------------------------------------------------------------------------

    public function test_ship_stock_decreases_on_hand_and_reserved(): void
    {
        app(ReceiveStockAction::class)->execute($this->dto(100.0));
        app(ReserveStockAction::class)->execute($this->dto(30.0));

        $result = app(ShipStockAction::class)->execute($this->dto(30.0));

        $this->assertTrue($result->isSuccess());

        $item = InventoryItem::query()
            ->where('warehouse_id', $this->warehouse->id)
            ->where('product_id', $this->product->id)
            ->firstOrFail();

        $this->assertEquals('70.0000', $item->on_hand_qty);
        $this->assertEquals('0.0000', $item->reserved_qty);

        $entry = StockLedgerEntry::query()
            ->where('inventory_item_id', $item->id)
            ->where('movement_type', LedgerMovementType::SalesIssue->value)
            ->firstOrFail();

        $this->assertEquals('30.0000', $entry->quantity);
        $this->assertEquals('100.0000', $entry->on_hand_before);
        $this->assertEquals('70.0000', $entry->on_hand_after);
        $this->assertEquals('30.0000', $entry->reserved_before);
        $this->assertEquals('0.0000', $entry->reserved_after);
    }

    public function test_ship_without_reservation_throws_invalid_movement_exception(): void
    {
        app(ReceiveStockAction::class)->execute($this->dto(100.0));
        // No ReserveStockAction called — reserved_qty stays at 0.

        $this->expectException(InvalidInventoryMovementException::class);

        app(ShipStockAction::class)->execute($this->dto(20.0));
    }

    public function test_ship_more_than_reserved_throws_invalid_movement_exception(): void
    {
        app(ReceiveStockAction::class)->execute($this->dto(100.0));
        app(ReserveStockAction::class)->execute($this->dto(5.0));

        $this->expectException(InvalidInventoryMovementException::class);

        app(ShipStockAction::class)->execute($this->dto(20.0));
    }

    // -------------------------------------------------------------------------
    // Direct Issue (no reservation required)
    // -------------------------------------------------------------------------

    public function test_direct_issue_decreases_on_hand_without_touching_reserved(): void
    {
        app(ReceiveStockAction::class)->execute($this->dto(100.0));
        app(ReserveStockAction::class)->execute($this->dto(10.0));

        $result = app(DirectIssueStockAction::class)->execute($this->dto(25.0));

        $this->assertTrue($result->isSuccess());

        $item = InventoryItem::query()
            ->where('warehouse_id', $this->warehouse->id)
            ->where('product_id', $this->product->id)
            ->firstOrFail();

        $this->assertEquals('75.0000', $item->on_hand_qty);
        $this->assertEquals('10.0000', $item->reserved_qty);

        $entry = StockLedgerEntry::query()
            ->where('inventory_item_id', $item->id)
            ->where('movement_type', LedgerMovementType::DirectIssue->value)
            ->firstOrFail();

        $this->assertEquals('25.0000', $entry->quantity);
        $this->assertEquals('100.0000', $entry->on_hand_before);
        $this->assertEquals('75.0000', $entry->on_hand_after);
        $this->assertEquals('10.0000', $entry->reserved_before);
        $this->assertEquals('10.0000', $entry->reserved_after);
    }

    public function test_direct_issue_over_on_hand_throws_insufficient_stock_exception(): void
    {
        app(ReceiveStockAction::class)->execute($this->dto(10.0));

        $this->expectException(InsufficientStockException::class);

        app(DirectIssueStockAction::class)->execute($this->dto(20.0));
    }
}
