<?php

declare(strict_types=1);

namespace Tests\Feature\Inventory;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Modules\Inventory\InventoryItems\Application\Actions\AdjustmentInAction;
use Modules\Inventory\InventoryItems\Application\DTO\StockOperationDTO;
use Modules\Inventory\InventoryItems\Domain\Exceptions\MissingAdjustmentValuationException;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * Mandatory manual valuation for upward adjustments
 * (EPIC-FIN-INTEGRATION-003A, Decision 2).
 *
 * A receipt has an invoice and an issue consumes a layer that was bought at a
 * price. An upward adjustment has neither — so the only honest value is the one
 * a person states. These tests pin that the platform refuses rather than
 * reaching for an average that would look like an answer.
 */
class InventoryValuationPolicyTest extends TestCase
{
    use DatabaseTransactions;

    private Company $company;

    private Warehouse $warehouse;

    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);
        $this->product = Product::factory()->create([
            'company_id' => $this->company->id,
            'product_type' => Product::TYPE_RAW_MATERIAL,
            // Deliberately priced: if the guard ever regressed into a fallback,
            // these are the numbers it would silently reach for.
            'average_cost' => 99.0,
            'last_purchase_cost' => 88.0,
            'current_fifo_cost' => 77.0,
        ]);
    }

    private function dto(array $overrides = []): StockOperationDTO
    {
        return StockOperationDTO::fromArray(array_merge([
            'warehouse_id' => $this->warehouse->id,
            'product_id' => $this->product->id,
            'company_id' => $this->company->id,
            'quantity' => 10.0,
        ], $overrides));
    }

    public function test_an_increase_without_a_stated_value_is_rejected(): void
    {
        $this->expectException(MissingAdjustmentValuationException::class);

        app(AdjustmentInAction::class)->execute($this->dto());
    }

    /**
     * The product carries an average, a last-purchase and a FIFO cost. None of
     * them may rescue an unvalued adjustment — that is the whole policy.
     */
    public function test_the_products_own_costs_do_not_rescue_an_unvalued_increase(): void
    {
        // The product carries average 99, last-purchase 88 and FIFO 77. The
        // property under test is that the refusal happens ANYWAY — asserting on
        // the message text would be fragile, since a UUID can contain any digits.
        $this->expectException(MissingAdjustmentValuationException::class);

        app(AdjustmentInAction::class)->execute($this->dto());
    }

    public function test_nothing_is_written_when_the_valuation_is_missing(): void
    {
        try {
            app(AdjustmentInAction::class)->execute($this->dto());
        } catch (MissingAdjustmentValuationException) {
            // expected
        }

        // The guard runs before the transaction opens, so the refusal must leave
        // no stock behind — a rejected adjustment that still moved stock would be
        // worse than one that posted.
        $this->assertDatabaseMissing('inventory_items', [
            'product_id' => $this->product->id,
            'on_hand_qty' => 10.0,
        ]);
    }

    public function test_a_stated_unit_cost_is_accepted(): void
    {
        $result = app(AdjustmentInAction::class)->execute($this->dto(['unit_cost' => 12.5]));

        $this->assertTrue($result->isSuccess());
    }

    public function test_a_stated_total_value_is_accepted_and_the_unit_cost_derived(): void
    {
        // 250 over 10 units is 25.00 each — arithmetic, not inference.
        $dto = $this->dto(['total_value' => 250.0]);

        $this->assertSame(25.0, $dto->statedUnitCost());
        $this->assertTrue(app(AdjustmentInAction::class)->execute($dto)->isSuccess());
    }

    public function test_a_stated_unit_cost_wins_over_a_stated_total(): void
    {
        $dto = $this->dto(['unit_cost' => 3.0, 'total_value' => 999.0]);

        $this->assertSame(3.0, $dto->statedUnitCost());
    }

    public function test_a_zero_valuation_is_a_stated_value_not_a_missing_one(): void
    {
        // Free stock is real — samples, donations, internal transfers. Zero is an
        // answer; the policy objects to silence, not to zero.
        $this->assertSame(0.0, $this->dto(['unit_cost' => 0.0])->statedUnitCost());
    }
}
