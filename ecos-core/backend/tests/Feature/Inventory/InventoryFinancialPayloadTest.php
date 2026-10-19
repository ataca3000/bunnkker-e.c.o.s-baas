<?php

declare(strict_types=1);

namespace Tests\Feature\Inventory;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Modules\Finance\Integration\Application\Bridge\EventPostingCatalog;
use Modules\Inventory\DomainEvents\Events\InventoryStockReceived;
use Modules\Inventory\Products\Domain\Enums\InventoryClass;
use Modules\Inventory\Products\Domain\Exceptions\UnknownInventoryClassException;
use Modules\Inventory\Products\Domain\Models\Product;
use Tests\TestCase;

/**
 * The financial payload on inventory events (EPIC-FIN-INTEGRATION-003).
 *
 * The property under test is that Finance can value and classify a stock
 * movement using ONLY what the event carries. Every assertion here works from
 * the serialized payload — the same view the bridge gets — so a regression that
 * moved a value back behind an Inventory lookup would fail these tests.
 */
class InventoryFinancialPayloadTest extends TestCase
{
    use DatabaseTransactions;

    private function event(
        InventoryClass $class = InventoryClass::RawMaterial,
        float $qty = 12.0,
        float $unitCost = 7.5,
    ): InventoryStockReceived {
        return new InventoryStockReceived(
            inventoryItemId: 'item-1',
            warehouseId: 'wh-1',
            productId: 'prod-1',
            companyId: 'co-1',
            quantityReceived: $qty,
            onHandBefore: 0.0,
            onHandAfter: $qty,
            inventoryClass: $class,
            unitCost: $unitCost,
            referenceType: 'goods_receipt',
            referenceId: 'gr-1',
        );
    }

    public function test_the_payload_carries_every_attribute_finance_needs(): void
    {
        $payload = $this->event()->toArray();

        foreach ([
            'company_id', 'warehouse_id', 'product_id', 'currency',
            'inventory_class', 'quantity', 'unit_cost', 'extended_cost',
            'posting_amount', 'reference_type', 'reference_id', 'occurred_at', 'actor_id',
        ] as $key) {
            $this->assertArrayHasKey($key, $payload, "Financial payload is missing '{$key}'.");
        }
    }

    public function test_extended_cost_is_derived_from_the_quantity_that_moved(): void
    {
        $payload = $this->event(qty: 12.0, unitCost: 7.5)->toArray();

        // Derived, never passed in — so the posted value cannot disagree with
        // the movement it represents.
        $this->assertSame(90.0, $payload['extended_cost']);
        $this->assertSame(90.0, $payload['posting_amount']);
    }

    public function test_the_class_travels_as_its_canonical_string(): void
    {
        $this->assertSame('raw_material', $this->event(InventoryClass::RawMaterial)->toArray()['inventory_class']);
        $this->assertSame('packaging_material', $this->event(InventoryClass::PackagingMaterial)->toArray()['inventory_class']);
        $this->assertSame('finished_good', $this->event(InventoryClass::FinishedGood)->toArray()['inventory_class']);
    }

    /** The whole point: Finance values the event without asking Inventory anything. */
    public function test_finance_can_value_the_event_from_the_payload_alone(): void
    {
        $payload = $this->event(qty: 12.0, unitCost: 7.5)->toArray();

        $financial = app(EventPostingCatalog::class)
            ->translate('inventory.stock.received', 'evt-1', $payload);

        $this->assertNotNull($financial, 'A fully valued receipt must translate into a financial event.');
        $this->assertSame('co-1', $financial->companyId);
        $this->assertSame(90.0, $financial->amount('net'));
        $this->assertSame('inventory.goods_receipt', $financial->eventType->value);
    }

    /**
     * Before this EPIC the receipt event carried no value at all, so the catalog
     * returned null and the event was silently unpostable. That is the exact
     * regression this guards.
     */
    public function test_a_receipt_without_a_value_is_still_refused(): void
    {
        $payload = $this->event()->toArray();
        unset($payload['extended_cost'], $payload['posting_amount']);

        $this->assertNull(
            app(EventPostingCatalog::class)->translate('inventory.stock.received', 'evt-2', $payload),
            'An unvaluable receipt must be refused, never posted at zero.',
        );
    }

    public function test_an_unclassifiable_product_stops_the_publish_rather_than_guessing(): void
    {
        $this->expectException(UnknownInventoryClassException::class);

        InventoryClass::fromProductType('consumable', 'prod-1');
    }

    public function test_every_seeded_product_type_is_classifiable(): void
    {
        // Guards the real data path: whatever the factory can produce, the
        // publisher must be able to classify.
        foreach (Product::TYPES as $type) {
            $this->assertInstanceOf(InventoryClass::class, InventoryClass::fromProductType($type));
        }
    }
}
