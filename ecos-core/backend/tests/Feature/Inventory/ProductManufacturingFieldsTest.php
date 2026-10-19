<?php

declare(strict_types=1);

namespace Tests\Feature\Inventory;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Modules\Inventory\Products\Domain\Enums\CostSource;
use Modules\Inventory\Products\Domain\Models\Product;
use Tests\TestCase;

/**
 * PKG-01: Product manufacturing fields (MFG-M001).
 *
 * Covers: migration columns, defaults, enum casting, capability flags,
 * factory states, and backward compatibility with existing product creation.
 */
class ProductManufacturingFieldsTest extends TestCase
{
    use RefreshDatabase;

    // ── 1. Migration columns exist ────────────────────────────────────────────

    public function test_products_table_has_cost_source_column(): void
    {
        $this->assertTrue(Schema::hasColumn('products', 'cost_source'));
    }

    public function test_products_table_has_can_manufacture_column(): void
    {
        $this->assertTrue(Schema::hasColumn('products', 'can_manufacture'));
    }

    public function test_products_table_has_can_disassemble_column(): void
    {
        $this->assertTrue(Schema::hasColumn('products', 'can_disassemble'));
    }

    public function test_products_table_has_allow_negative_stock_column(): void
    {
        $this->assertTrue(Schema::hasColumn('products', 'allow_negative_stock'));
    }

    // ── 2. Default values on creation ─────────────────────────────────────────

    public function test_cost_source_defaults_to_purchase(): void
    {
        $product = Product::factory()->create();

        $this->assertSame(CostSource::Purchase, $product->fresh()->cost_source);
    }

    public function test_can_manufacture_defaults_to_false(): void
    {
        $product = Product::factory()->create();

        $this->assertFalse($product->fresh()->can_manufacture);
    }

    public function test_can_disassemble_defaults_to_false(): void
    {
        $product = Product::factory()->create();

        $this->assertFalse($product->fresh()->can_disassemble);
    }

    public function test_allow_negative_stock_defaults_to_false(): void
    {
        $product = Product::factory()->create();

        $this->assertFalse($product->fresh()->allow_negative_stock);
    }

    // ── 3. CostSource enum casting ────────────────────────────────────────────

    public function test_cost_source_is_cast_to_enum(): void
    {
        $product = Product::factory()->create(['cost_source' => 'recipe']);

        $this->assertInstanceOf(CostSource::class, $product->fresh()->cost_source);
        $this->assertSame(CostSource::Recipe, $product->fresh()->cost_source);
    }

    public function test_cost_source_purchase_case(): void
    {
        $product = Product::factory()->create(['cost_source' => CostSource::Purchase->value]);

        $this->assertSame(CostSource::Purchase, $product->fresh()->cost_source);
        $this->assertSame('Purchase (GR)', $product->fresh()->cost_source->label());
    }

    public function test_cost_source_recipe_case(): void
    {
        $product = Product::factory()->create(['cost_source' => CostSource::Recipe->value]);

        $this->assertSame(CostSource::Recipe, $product->fresh()->cost_source);
        $this->assertSame('Recipe (Manufacturing)', $product->fresh()->cost_source->label());
    }

    public function test_cost_source_hybrid_case(): void
    {
        $product = Product::factory()->create(['cost_source' => CostSource::Hybrid->value]);

        $this->assertSame(CostSource::Hybrid, $product->fresh()->cost_source);
        $this->assertSame('Hybrid (Purchase + Recipe)', $product->fresh()->cost_source->label());
    }

    public function test_cost_source_purchase_is_not_manufacturing_relevant(): void
    {
        $this->assertFalse(CostSource::Purchase->isManufacturingRelevant());
    }

    public function test_cost_source_recipe_is_manufacturing_relevant(): void
    {
        $this->assertTrue(CostSource::Recipe->isManufacturingRelevant());
    }

    public function test_cost_source_hybrid_is_manufacturing_relevant(): void
    {
        $this->assertTrue(CostSource::Hybrid->isManufacturingRelevant());
    }

    // ── 4. can_manufacture flag ───────────────────────────────────────────────

    public function test_can_manufacture_can_be_set_to_true(): void
    {
        $product = Product::factory()->create(['can_manufacture' => true]);

        $this->assertTrue($product->fresh()->can_manufacture);
    }

    public function test_can_manufacture_is_cast_to_boolean(): void
    {
        $product = Product::factory()->create(['can_manufacture' => true]);

        $this->assertIsBool($product->fresh()->can_manufacture);
    }

    public function test_manufacturable_factory_state(): void
    {
        $product = Product::factory()->manufacturable()->create();

        $this->assertTrue($product->can_manufacture);
        $this->assertSame(CostSource::Recipe, $product->cost_source);
    }

    // ── 5. can_disassemble flag ───────────────────────────────────────────────

    public function test_can_disassemble_can_be_set_to_true(): void
    {
        $product = Product::factory()->create(['can_disassemble' => true]);

        $this->assertTrue($product->fresh()->can_disassemble);
    }

    public function test_can_disassemble_is_cast_to_boolean(): void
    {
        $product = Product::factory()->create(['can_disassemble' => true]);

        $this->assertIsBool($product->fresh()->can_disassemble);
    }

    // ── 6. allow_negative_stock flag ─────────────────────────────────────────

    public function test_allow_negative_stock_can_be_set_to_true(): void
    {
        $product = Product::factory()->create(['allow_negative_stock' => true]);

        $this->assertTrue($product->fresh()->allow_negative_stock);
    }

    public function test_allow_negative_stock_is_cast_to_boolean(): void
    {
        $product = Product::factory()->create(['allow_negative_stock' => true]);

        $this->assertIsBool($product->fresh()->allow_negative_stock);
    }

    public function test_allows_negative_stock_factory_state(): void
    {
        $product = Product::factory()->allowsNegativeStock()->create();

        $this->assertTrue($product->allow_negative_stock);
    }

    // ── 7. Hybrid factory state ───────────────────────────────────────────────

    public function test_hybrid_factory_state_sets_correct_fields(): void
    {
        $product = Product::factory()->hybrid()->create();

        $this->assertTrue($product->can_manufacture);
        $this->assertTrue($product->can_disassemble);
        $this->assertSame(CostSource::Hybrid, $product->cost_source);
    }

    // ── 8. Backward compatibility ─────────────────────────────────────────────

    public function test_existing_factory_calls_still_work_without_new_fields(): void
    {
        // Simulate pre-PKG-01 factory usage — should not throw
        $product = Product::factory()->create([
            'sku' => 'COMPAT-001',
            'name' => 'Legacy Product',
            'is_active' => true,
            'product_type' => Product::TYPE_FINISHED_GOOD,
        ]);

        $this->assertDatabaseHas('products', ['sku' => 'COMPAT-001']);
        // New fields use DB defaults
        $this->assertSame(CostSource::Purchase, $product->fresh()->cost_source);
        $this->assertFalse($product->fresh()->can_manufacture);
        $this->assertFalse($product->fresh()->can_disassemble);
        $this->assertFalse($product->fresh()->allow_negative_stock);
    }

    public function test_finished_good_factory_state_still_works(): void
    {
        $product = Product::factory()->finishedGood()->create();

        $this->assertSame(Product::TYPE_FINISHED_GOOD, $product->product_type);
        $this->assertSame(CostSource::Purchase, $product->cost_source);
    }

    public function test_raw_material_factory_state_still_works(): void
    {
        $product = Product::factory()->rawMaterial()->create();

        $this->assertSame(Product::TYPE_RAW_MATERIAL, $product->product_type);
        $this->assertFalse($product->allow_negative_stock);
    }

    // ── 9. Product type is classification only ────────────────────────────────

    public function test_product_type_constants_unchanged(): void
    {
        $this->assertSame('finished_good', Product::TYPE_FINISHED_GOOD);
        $this->assertSame('raw_material', Product::TYPE_RAW_MATERIAL);
        $this->assertSame([Product::TYPE_FINISHED_GOOD, Product::TYPE_RAW_MATERIAL, Product::TYPE_PACKAGING_MATERIAL], Product::TYPES);
    }

    public function test_raw_material_can_have_any_cost_source(): void
    {
        // product_type is classification only — no constraint on cost_source
        $product = Product::factory()->rawMaterial()->create([
            'cost_source' => CostSource::Hybrid->value,
        ]);

        $this->assertSame(Product::TYPE_RAW_MATERIAL, $product->product_type);
        $this->assertSame(CostSource::Hybrid, $product->cost_source);
    }

    // ── 10. Updating existing product ─────────────────────────────────────────

    public function test_existing_product_can_be_updated_with_new_fields(): void
    {
        $product = Product::factory()->create();

        $product->update([
            'cost_source' => CostSource::Recipe->value,
            'can_manufacture' => true,
            'can_disassemble' => false,
            'allow_negative_stock' => false,
        ]);

        $fresh = $product->fresh();
        $this->assertSame(CostSource::Recipe, $fresh->cost_source);
        $this->assertTrue($fresh->can_manufacture);
        $this->assertFalse($fresh->can_disassemble);
        $this->assertFalse($fresh->allow_negative_stock);
    }
}
