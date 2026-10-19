<?php

declare(strict_types=1);

namespace Tests\Feature\Inventory;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\MasterData\Categories\Domain\Models\Category;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * Product reclassification guard (EPIC-FIN-INTEGRATION-003A, Decision 3).
 *
 * product_type decides which GL account a stock movement posts to. Changing it
 * while stock exists sends future movements to a new account while the value
 * already on the books stays on the old one — silently, and forever. So it is
 * blocked while a balance exists, and allowed once there is nothing to strand.
 */
class ProductReclassificationGuardTest extends TestCase
{
    use DatabaseTransactions;

    private Company $company;

    private Warehouse $warehouse;

    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->actingAs(User::factory()->create(['company_id' => $this->company->id]));
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);
        $this->product = Product::factory()->create([
            'company_id' => $this->company->id,
            'product_type' => Product::TYPE_RAW_MATERIAL,
            // A raw material needs a material-scoped category, or the unrelated
            // category rule fires and masks what these tests are checking.
            'category_id' => Category::factory()->create(['category_scope' => 'material'])->id,
        ]);
    }

    /** @param array<string, mixed> $overrides */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'sku' => $this->product->sku,
            'name' => $this->product->name,
            'category_id' => $this->product->category_id,
            'unit_id' => $this->product->unit_id,
            'product_type' => $this->product->product_type,
        ], $overrides);
    }

    private function stock(float $qty): void
    {
        InventoryItem::query()->create([
            'warehouse_id' => $this->warehouse->id,
            'product_id' => $this->product->id,
            'company_id' => $this->company->id,
            'on_hand_qty' => $qty,
            'reserved_qty' => 0,
        ]);
    }

    public function test_reclassification_is_rejected_while_stock_exists(): void
    {
        $this->stock(5.0);

        $this->putJson("/api/products/{$this->product->id}", $this->payload([
            'product_type' => Product::TYPE_FINISHED_GOOD,
        ]))->assertStatus(422)->assertJsonValidationErrors('product_type');

        $this->assertSame(
            Product::TYPE_RAW_MATERIAL,
            $this->product->fresh()->product_type,
            'A rejected reclassification must leave the classification untouched.',
        );
    }

    public function test_reclassification_is_allowed_at_zero_stock(): void
    {
        $this->stock(0.0);

        $this->putJson("/api/products/{$this->product->id}", $this->payload([
            'product_type' => Product::TYPE_FINISHED_GOOD,
            'category_id' => Category::factory()->create(['category_scope' => 'product'])->id,
        ]))->assertSuccessful();

        $this->assertSame(Product::TYPE_FINISHED_GOOD, $this->product->fresh()->product_type);
    }

    public function test_reclassification_is_allowed_when_no_stock_record_exists(): void
    {
        $this->putJson("/api/products/{$this->product->id}", $this->payload([
            'product_type' => Product::TYPE_FINISHED_GOOD,
            'category_id' => Category::factory()->create(['category_scope' => 'product'])->id,
        ]))->assertSuccessful();
    }

    /** Editing other fields must stay possible for a stocked product. */
    public function test_stock_does_not_block_edits_that_keep_the_same_type(): void
    {
        $this->stock(5.0);

        $this->putJson("/api/products/{$this->product->id}", $this->payload([
            'name' => 'Renamed while stocked',
        ]))->assertSuccessful();

        $this->assertSame('Renamed while stocked', $this->product->fresh()->name);
    }

    public function test_the_refusal_explains_the_balance_and_the_way_forward(): void
    {
        $this->stock(5.0);

        $response = $this->putJson("/api/products/{$this->product->id}", $this->payload([
            'product_type' => Product::TYPE_FINISHED_GOOD,
        ]));

        $message = implode(' ', $response->json('errors.product_type') ?? []);

        $this->assertStringContainsString('5', $message);
        $this->assertStringContainsString('Reclassification Journal', $message);
    }
}
