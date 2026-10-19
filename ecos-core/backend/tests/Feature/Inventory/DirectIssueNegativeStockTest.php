<?php

declare(strict_types=1);

namespace Tests\Feature\Inventory;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Modules\Inventory\InventoryItems\Application\Actions\DirectIssueStockAction;
use Modules\Inventory\InventoryItems\Application\DTO\StockOperationDTO;
use Modules\Inventory\InventoryItems\Domain\Enums\LedgerMovementType;
use Modules\Inventory\InventoryItems\Domain\Exceptions\InsufficientStockException;
use Modules\Inventory\InventoryItems\Domain\Exceptions\InvalidInventoryMovementException;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\InventoryItems\Domain\Models\StockLedgerEntry;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * TASK-RESERVATION-IMPLEMENTATION-C1
 *
 * Verifies that DirectIssueStockAction honours allow_negative_stock (ADR-027 v1.1 P07).
 */
class DirectIssueNegativeStockTest extends TestCase
{
    use DatabaseTransactions;

    private Company $company;

    private Warehouse $warehouse;

    protected function setUp(): void
    {
        parent::setUp();
        $this->company = Company::factory()->create();
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function seedStock(Product $product, float $onHand, float $reserved = 0.0): InventoryItem
    {
        return InventoryItem::query()->create([
            'warehouse_id' => $this->warehouse->id,
            'product_id' => $product->id,
            'company_id' => $this->company->id,
            'on_hand_qty' => $onHand,
            'reserved_qty' => $reserved,
        ]);
    }

    private function dto(Product $product, float $quantity): StockOperationDTO
    {
        return StockOperationDTO::fromArray([
            'warehouse_id' => $this->warehouse->id,
            'product_id' => $product->id,
            'company_id' => $this->company->id,
            'quantity' => $quantity,
        ]);
    }

    // ── C1.1 ─────────────────────────────────────────────────────────────────

    /**
     * on_hand=0, allow_negative_stock=true → issue proceeds, on_hand=-qty, ledger written.
     */
    public function test_direct_issue_allows_negative_stock_when_flag_enabled(): void
    {
        $product = Product::factory()->allowsNegativeStock()->create();
        $this->seedStock($product, onHand: 0.0);

        $result = app(DirectIssueStockAction::class)->execute($this->dto($product, 5.0));

        $this->assertTrue($result->isSuccess());

        $item = InventoryItem::query()
            ->where('warehouse_id', $this->warehouse->id)
            ->where('product_id', $product->id)
            ->firstOrFail();

        $this->assertEquals('-5.0000', $item->on_hand_qty);
        $this->assertEquals('0.0000', $item->reserved_qty, 'DirectIssue must not touch reserved_qty');

        $entry = StockLedgerEntry::query()->where('inventory_item_id', $item->id)->firstOrFail();
        $this->assertEquals(LedgerMovementType::DirectIssue->value, $entry->movement_type->value);
        $this->assertEquals('0.0000', $entry->on_hand_before);
        $this->assertEquals('-5.0000', $entry->on_hand_after);
    }

    // ── C1.2 ─────────────────────────────────────────────────────────────────

    /**
     * on_hand=5, qty=5, allow_negative_stock=false → on_hand=0, normal success path unchanged.
     */
    public function test_direct_issue_succeeds_normally_with_sufficient_stock(): void
    {
        $product = Product::factory()->create(['allow_negative_stock' => false]);
        $this->seedStock($product, onHand: 5.0);

        $result = app(DirectIssueStockAction::class)->execute($this->dto($product, 5.0));

        $this->assertTrue($result->isSuccess());

        $item = InventoryItem::query()
            ->where('warehouse_id', $this->warehouse->id)
            ->where('product_id', $product->id)
            ->firstOrFail();

        $this->assertEquals('0.0000', $item->on_hand_qty);
    }

    // ── C1.3 ─────────────────────────────────────────────────────────────────

    /**
     * on_hand=0, allow_negative_stock=false → InsufficientStockException (guard preserved).
     */
    public function test_direct_issue_throws_insufficient_when_flag_disabled_and_stock_low(): void
    {
        $product = Product::factory()->create(['allow_negative_stock' => false]);
        $this->seedStock($product, onHand: 0.0);

        $this->expectException(InsufficientStockException::class);

        app(DirectIssueStockAction::class)->execute($this->dto($product, 5.0));
    }

    // ── C1.4 ─────────────────────────────────────────────────────────────────

    /**
     * on_hand=3, qty=5, allow_negative_stock=true → on_hand=-2, ledger records negative.
     */
    public function test_direct_issue_allows_going_below_zero_when_flag_enabled(): void
    {
        $product = Product::factory()->allowsNegativeStock()->create();
        $this->seedStock($product, onHand: 3.0);

        $result = app(DirectIssueStockAction::class)->execute($this->dto($product, 5.0));

        $this->assertTrue($result->isSuccess());

        $item = InventoryItem::query()
            ->where('warehouse_id', $this->warehouse->id)
            ->where('product_id', $product->id)
            ->firstOrFail();

        $this->assertEquals('-2.0000', $item->on_hand_qty);

        $entry = StockLedgerEntry::query()->where('inventory_item_id', $item->id)->firstOrFail();
        $this->assertEquals('3.0000', $entry->on_hand_before);
        $this->assertEquals('-2.0000', $entry->on_hand_after);
    }

    // ── C1.5 ─────────────────────────────────────────────────────────────────

    /**
     * on_hand=3, reserved=2, qty=5, allow_negative_stock=true
     * → F-INV-H1 bypassed, on_hand=-2, reserved_qty unchanged, no exception.
     */
    public function test_direct_issue_bypasses_h1_invariant_when_negative_stock_enabled(): void
    {
        $product = Product::factory()->allowsNegativeStock()->create();
        $this->seedStock($product, onHand: 3.0, reserved: 2.0);

        // Without C1 this would throw InvalidInventoryMovementException (F-INV-H1).
        $result = app(DirectIssueStockAction::class)->execute($this->dto($product, 5.0));

        $this->assertTrue($result->isSuccess());

        $item = InventoryItem::query()
            ->where('warehouse_id', $this->warehouse->id)
            ->where('product_id', $product->id)
            ->firstOrFail();

        $this->assertEquals('-2.0000', $item->on_hand_qty);
        $this->assertEquals('2.0000', $item->reserved_qty, 'DirectIssue must not touch reserved_qty');
    }
}
