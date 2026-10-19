<?php

declare(strict_types=1);

namespace Tests\Feature\Manufacturing;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Manufacturing\BillsOfMaterials\Domain\Contracts\RecipeRepositoryInterface;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\BillOfMaterial;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\Recipe;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\RecipeLine;
use Tests\TestCase;

/**
 * PKG-02A: Recipe Foundation
 *
 * Covers: migration columns, Recipe/RecipeLine domain models, versioning,
 * active recipe resolution, Product↔Recipe relationships, validation rules,
 * and backward compatibility with the BOM persistence layer.
 */
class RecipeFoundationTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    // ── 1. Migration: bom_version_number column ───────────────────────────────

    public function test_bills_of_materials_has_bom_version_number_column(): void
    {
        $this->assertTrue(Schema::hasColumn('bills_of_materials', 'bom_version_number'));
    }

    // ── 2. Recipe model maps to bills_of_materials ────────────────────────────

    public function test_recipe_uses_bills_of_materials_table(): void
    {
        $recipe = new Recipe;

        $this->assertSame('bills_of_materials', $recipe->getTable());
    }

    public function test_recipe_line_uses_bill_of_material_lines_table(): void
    {
        $line = new RecipeLine;

        $this->assertSame('bill_of_material_lines', $line->getTable());
    }

    // ── 3. Recipe persists to DB ──────────────────────────────────────────────

    public function test_recipe_can_be_created_and_retrieved(): void
    {
        $product = Product::factory()->finishedGood()->manufacturable()->create();
        $material = Product::factory()->rawMaterial()->create();

        $recipe = Recipe::create([
            'bom_number' => 'BOM-T0001',
            'product_id' => $product->id,
            'version' => '1.0',
            'bom_version_number' => 1,
            'is_active' => true,
        ]);

        $recipe->components()->create([
            'raw_material_id' => $material->id,
            'quantity' => 3.0,
        ]);

        $fresh = Recipe::with('components')->find($recipe->id);

        $this->assertNotNull($fresh);
        $this->assertSame($product->id, $fresh->product_id);
        $this->assertSame(1, $fresh->bom_version_number);
        $this->assertCount(1, $fresh->components);
        $this->assertSame('3.0000', $fresh->components->first()->quantity);
    }

    // ── 4. Versioning — sequential bom_version_number ─────────────────────────

    public function test_recipe_repository_assigns_version_number_sequentially(): void
    {
        $product = Product::factory()->finishedGood()->manufacturable()->create();
        $material = Product::factory()->rawMaterial()->create();

        $repo = app(RecipeRepositoryInterface::class);

        $v1 = $repo->create([
            'bom_number' => $repo->nextBomNumber(),
            'product_id' => $product->id,
            'version' => '1.0',
            'bom_version_number' => $repo->nextVersionNumber($product->id),
            'is_active' => true,
        ], [['raw_material_id' => $material->id, 'quantity' => 2.0]]);

        $v2 = $repo->create([
            'bom_number' => $repo->nextBomNumber(),
            'product_id' => $product->id,
            'version' => '2.0',
            'bom_version_number' => $repo->nextVersionNumber($product->id),
            'is_active' => false,
        ], [['raw_material_id' => $material->id, 'quantity' => 3.0]]);

        $this->assertSame(1, $v1->bom_version_number);
        $this->assertSame(2, $v2->bom_version_number);
    }

    public function test_version_numbers_are_independent_per_product(): void
    {
        $productA = Product::factory()->finishedGood()->manufacturable()->create();
        $productB = Product::factory()->finishedGood()->manufacturable()->create();
        $material = Product::factory()->rawMaterial()->create();

        $repo = app(RecipeRepositoryInterface::class);

        $repo->create([
            'bom_number' => 'BOM-A0001',
            'product_id' => $productA->id,
            'version' => '1.0',
            'bom_version_number' => $repo->nextVersionNumber($productA->id),
            'is_active' => true,
        ], [['raw_material_id' => $material->id, 'quantity' => 1.0]]);

        $nextA = $repo->nextVersionNumber($productA->id);
        $nextB = $repo->nextVersionNumber($productB->id);

        $this->assertSame(2, $nextA);
        $this->assertSame(1, $nextB);
    }

    // ── 5. Active recipe resolution ───────────────────────────────────────────

    public function test_only_one_active_recipe_per_product(): void
    {
        $product = Product::factory()->finishedGood()->manufacturable()->create();
        $material = Product::factory()->rawMaterial()->create();

        $repo = app(RecipeRepositoryInterface::class);

        $v1 = $repo->create([
            'bom_number' => 'BOM-V1',
            'product_id' => $product->id,
            'version' => '1.0',
            'bom_version_number' => 1,
            'is_active' => true,
        ], [['raw_material_id' => $material->id, 'quantity' => 1.0]]);

        // Creating a second active recipe should deactivate the first
        $v2 = $repo->create([
            'bom_number' => 'BOM-V2',
            'product_id' => $product->id,
            'version' => '2.0',
            'bom_version_number' => 2,
            'is_active' => true,
        ], [['raw_material_id' => $material->id, 'quantity' => 2.0]]);

        $this->assertFalse($v1->fresh()->is_active);
        $this->assertTrue($v2->fresh()->is_active);
    }

    public function test_activate_switches_active_version(): void
    {
        $product = Product::factory()->finishedGood()->manufacturable()->create();
        $material = Product::factory()->rawMaterial()->create();

        $repo = app(RecipeRepositoryInterface::class);

        $v1 = $repo->create([
            'bom_number' => 'BOM-ACT1',
            'product_id' => $product->id,
            'version' => '1.0',
            'bom_version_number' => 1,
            'is_active' => true,
        ], [['raw_material_id' => $material->id, 'quantity' => 1.0]]);

        $v2 = $repo->create([
            'bom_number' => 'BOM-ACT2',
            'product_id' => $product->id,
            'version' => '2.0',
            'bom_version_number' => 2,
            'is_active' => false,
        ], [['raw_material_id' => $material->id, 'quantity' => 2.0]]);

        $repo->activate($v2);

        $this->assertFalse($v1->fresh()->is_active);
        $this->assertTrue($v2->fresh()->is_active);
    }

    public function test_find_active_by_product_returns_active_recipe(): void
    {
        $product = Product::factory()->finishedGood()->manufacturable()->create();
        $material = Product::factory()->rawMaterial()->create();

        $repo = app(RecipeRepositoryInterface::class);

        $active = $repo->create([
            'bom_number' => 'BOM-FA',
            'product_id' => $product->id,
            'version' => '1.0',
            'bom_version_number' => 1,
            'is_active' => true,
        ], [['raw_material_id' => $material->id, 'quantity' => 1.5]]);

        $found = $repo->findActiveByProduct($product->id);

        $this->assertNotNull($found);
        $this->assertSame($active->id, $found->id);
    }

    public function test_find_active_by_product_returns_null_when_no_active_recipe(): void
    {
        $product = Product::factory()->finishedGood()->create();

        $result = app(RecipeRepositoryInterface::class)->findActiveByProduct($product->id);

        $this->assertNull($result);
    }

    // ── 6. Product → Recipe relationships ────────────────────────────────────

    public function test_product_recipes_returns_all_versions(): void
    {
        $product = Product::factory()->finishedGood()->manufacturable()->create();
        $material = Product::factory()->rawMaterial()->create();

        Recipe::create(['bom_number' => 'R1', 'product_id' => $product->id, 'version' => '1.0', 'bom_version_number' => 1, 'is_active' => false]);
        Recipe::create(['bom_number' => 'R2', 'product_id' => $product->id, 'version' => '2.0', 'bom_version_number' => 2, 'is_active' => true]);

        $this->assertCount(2, $product->recipes);
    }

    public function test_product_active_recipe_returns_active_version(): void
    {
        $product = Product::factory()->finishedGood()->manufacturable()->create();
        $material = Product::factory()->rawMaterial()->create();

        Recipe::create(['bom_number' => 'AR1', 'product_id' => $product->id, 'version' => '1.0', 'bom_version_number' => 1, 'is_active' => false]);
        $v2 = Recipe::create(['bom_number' => 'AR2', 'product_id' => $product->id, 'version' => '2.0', 'bom_version_number' => 2, 'is_active' => true]);

        $active = $product->activeRecipe;

        $this->assertNotNull($active);
        $this->assertSame($v2->id, $active->id);
    }

    public function test_product_has_recipe_returns_true_when_active_recipe_exists(): void
    {
        $product = Product::factory()->finishedGood()->manufacturable()->create();
        Recipe::create(['bom_number' => 'HR1', 'product_id' => $product->id, 'version' => '1.0', 'bom_version_number' => 1, 'is_active' => true]);

        $this->assertTrue($product->hasRecipe());
    }

    public function test_product_has_recipe_returns_false_with_no_recipe(): void
    {
        $product = Product::factory()->finishedGood()->create();

        $this->assertFalse($product->hasRecipe());
    }

    public function test_product_has_recipe_returns_false_when_only_inactive_recipes(): void
    {
        $product = Product::factory()->finishedGood()->create();
        Recipe::create(['bom_number' => 'INR', 'product_id' => $product->id, 'version' => '1.0', 'bom_version_number' => 1, 'is_active' => false]);

        $this->assertFalse($product->hasRecipe());
    }

    // ── 7. Validation — component ≠ output product ────────────────────────────

    public function test_recipe_component_cannot_be_the_same_as_output_product(): void
    {
        $product = Product::factory()->finishedGood()->manufacturable()->create();

        // Attempt to create a recipe where the component is the output product
        $response = $this->actingAs($this->user)->postJson('/api/boms', [
            'product_id' => $product->id,
            'version' => '1.0',
            'is_active' => true,
            'lines' => [
                ['raw_material_id' => $product->id, 'quantity' => 1.0],
            ],
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['lines.0.raw_material_id']);
    }

    public function test_recipe_requires_at_least_one_component(): void
    {
        $product = Product::factory()->finishedGood()->manufacturable()->create();

        $response = $this->actingAs($this->user)->postJson('/api/boms', [
            'product_id' => $product->id,
            'version' => '1.0',
            'is_active' => false,
            'lines' => [],
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['lines']);
    }

    public function test_recipe_rejects_zero_quantity_component(): void
    {
        $product = Product::factory()->finishedGood()->manufacturable()->create();
        $material = Product::factory()->rawMaterial()->create();

        $response = $this->actingAs($this->user)->postJson('/api/boms', [
            'product_id' => $product->id,
            'version' => '1.0',
            'is_active' => false,
            'lines' => [
                ['raw_material_id' => $material->id, 'quantity' => 0],
            ],
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['lines.0.quantity']);
    }

    public function test_recipe_ignores_waste_percentage_if_submitted(): void
    {
        $product = Product::factory()->finishedGood()->manufacturable()->create();
        $material = Product::factory()->rawMaterial()->create();

        // Submitting waste_percentage should be silently ignored (backward compat)
        $response = $this->actingAs($this->user)->postJson('/api/boms', [
            'product_id' => $product->id,
            'version' => '1.0',
            'is_active' => true,
            'lines' => [
                ['raw_material_id' => $material->id, 'quantity' => 2.5, 'waste_percentage' => 10],
            ],
        ]);

        $response->assertStatus(201);

        // waste_percentage not in response (deprecated)
        $line = $response->json('data.lines.0');
        $this->assertArrayNotHasKey('waste_percentage', $line);
    }

    // ── 8. Backward compatibility — BOM layer still works ─────────────────────

    public function test_bill_of_material_and_recipe_share_the_same_rows(): void
    {
        $product = Product::factory()->finishedGood()->manufacturable()->create();
        $material = Product::factory()->rawMaterial()->create();

        $bom = BillOfMaterial::create([
            'bom_number' => 'BOM-COMPAT',
            'product_id' => $product->id,
            'version' => '1.0',
            'bom_version_number' => 1,
            'is_active' => true,
        ]);

        $bom->lines()->create(['raw_material_id' => $material->id, 'quantity' => 4.0]);

        // Recipe model reads the same row
        $recipe = Recipe::find($bom->id);

        $this->assertNotNull($recipe);
        $this->assertSame($bom->id, $recipe->id);
        $this->assertSame($bom->bom_number, $recipe->bom_number);
        $this->assertCount(1, $recipe->components);
    }

    public function test_bom_version_number_cast_to_integer(): void
    {
        $product = Product::factory()->finishedGood()->create();

        $bom = BillOfMaterial::create([
            'bom_number' => 'BOM-INT',
            'product_id' => $product->id,
            'version' => '1.0',
            'bom_version_number' => 3,
            'is_active' => false,
        ]);

        $this->assertIsInt($bom->fresh()->bom_version_number);
        $this->assertSame(3, $bom->fresh()->bom_version_number);
    }

    public function test_find_all_by_product_returns_newest_first(): void
    {
        $product = Product::factory()->finishedGood()->manufacturable()->create();
        $material = Product::factory()->rawMaterial()->create();

        $repo = app(RecipeRepositoryInterface::class);

        $repo->create(['bom_number' => 'O1', 'product_id' => $product->id, 'version' => '1.0', 'bom_version_number' => 1, 'is_active' => false], [['raw_material_id' => $material->id, 'quantity' => 1.0]]);
        $repo->create(['bom_number' => 'O2', 'product_id' => $product->id, 'version' => '2.0', 'bom_version_number' => 2, 'is_active' => true], [['raw_material_id' => $material->id, 'quantity' => 2.0]]);

        $all = $repo->findAllByProduct($product->id);

        $this->assertCount(2, $all);
        $this->assertSame(2, $all->first()->bom_version_number);
    }
}
