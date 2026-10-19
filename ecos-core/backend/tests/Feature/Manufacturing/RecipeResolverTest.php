<?php

declare(strict_types=1);

namespace Tests\Feature\Manufacturing;

use Error;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Manufacturing\BillsOfMaterials\Domain\Exceptions\RecipeResolverException;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\Recipe;
use Modules\Manufacturing\BillsOfMaterials\Domain\Services\RecipeResolver;
use Modules\Manufacturing\BillsOfMaterials\Domain\ValueObjects\RecipeComponent;
use Modules\Manufacturing\BillsOfMaterials\Domain\ValueObjects\RecipeSnapshot;
use Tests\TestCase;

/**
 * PKG-02B: RecipeResolver — read-only domain service.
 *
 * Covers: happy path, all exception paths, snapshot immutability,
 * component accuracy, allow_negative_stock forwarding, bom_version_number
 * capture, and the unit-from-product rule.
 */
class RecipeResolverTest extends TestCase
{
    use RefreshDatabase;

    private RecipeResolver $resolver;

    protected function setUp(): void
    {
        parent::setUp();
        $this->resolver = app(RecipeResolver::class);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeOutput(): Product
    {
        return Product::factory()->finishedGood()->manufacturable()->create();
    }

    private function makeComponent(bool $active = true, bool $allowNegative = false): Product
    {
        return Product::factory()->rawMaterial()->create([
            'is_active' => $active,
            'allow_negative_stock' => $allowNegative,
        ]);
    }

    private function makeRecipe(Product $product, bool $isActive = true, int $version = 1): Recipe
    {
        return Recipe::create([
            'bom_number' => 'BOM-R'.uniqid(),
            'product_id' => $product->id,
            'version' => "{$version}.0",
            'bom_version_number' => $version,
            'is_active' => $isActive,
        ]);
    }

    private function addLine(Recipe $recipe, Product $component, float $qty = 2.0): void
    {
        $recipe->components()->create([
            'raw_material_id' => $component->id,
            'quantity' => $qty,
        ]);
    }

    // ── 1. Happy path — returns RecipeSnapshot ────────────────────────────────

    public function test_resolver_returns_recipe_snapshot_for_valid_recipe(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 3.5);

        $snapshot = $this->resolver->resolve($output->id);

        $this->assertInstanceOf(RecipeSnapshot::class, $snapshot);
        $this->assertSame($recipe->id, $snapshot->recipe_id);
        $this->assertSame($output->id, $snapshot->product_id);
        $this->assertSame($output->sku, $snapshot->product_sku);
        $this->assertSame($output->name, $snapshot->product_name);
    }

    public function test_snapshot_captures_bom_version_number(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output, isActive: true, version: 4);
        $this->addLine($recipe, $component);

        $snapshot = $this->resolver->resolve($output->id);

        $this->assertSame(4, $snapshot->bom_version_number);
    }

    public function test_snapshot_captures_version_label(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output, version: 2);
        $this->addLine($recipe, $component);

        $snapshot = $this->resolver->resolve($output->id);

        $this->assertSame('2.0', $snapshot->version);
        $this->assertSame($recipe->bom_number, $snapshot->bom_number);
    }

    public function test_snapshot_resolved_at_is_iso8601(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $this->addLine($this->makeRecipe($output), $component);

        $snapshot = $this->resolver->resolve($output->id);

        // Must be parseable as a date-time string
        $this->assertNotEmpty($snapshot->resolved_at);
        $this->assertNotFalse(strtotime($snapshot->resolved_at));
    }

    // ── 2. Components resolved correctly ──────────────────────────────────────

    public function test_snapshot_contains_correct_component_count(): void
    {
        $output = $this->makeOutput();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $this->makeComponent(), 1.0);
        $this->addLine($recipe, $this->makeComponent(), 2.0);
        $this->addLine($recipe, $this->makeComponent(), 3.0);

        $snapshot = $this->resolver->resolve($output->id);

        $this->assertCount(3, $snapshot->components);
        $this->assertSame(3, $snapshot->componentCount());
        $this->assertTrue($snapshot->hasComponents());
    }

    public function test_snapshot_component_is_recipe_component_instance(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $this->addLine($this->makeRecipe($output), $component, 4.0);

        $snapshot = $this->resolver->resolve($output->id);

        $this->assertInstanceOf(RecipeComponent::class, $snapshot->components[0]);
    }

    public function test_snapshot_component_carries_correct_product_data(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $this->addLine($this->makeRecipe($output), $component, 2.5);

        $resolved = $this->resolver->resolve($output->id)->components[0];

        $this->assertSame($component->id, $resolved->component_id);
        $this->assertSame($component->sku, $resolved->sku);
        $this->assertSame($component->name, $resolved->name);
        $this->assertSame(2.5, $resolved->quantity);
    }

    public function test_snapshot_unit_comes_from_component_product(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $this->addLine($this->makeRecipe($output), $component);

        $resolved = $this->resolver->resolve($output->id)->components[0];

        // Unit is from the component's Product — not from the recipe line
        $this->assertSame($component->unit->id, $resolved->unit_id);
        $this->assertSame($component->unit->name, $resolved->unit_name);
        $this->assertSame($component->unit->symbol, $resolved->unit_symbol);
    }

    public function test_allow_negative_stock_forwarded_from_component_product(): void
    {
        $output = $this->makeOutput();
        $allowsNegative = $this->makeComponent(allowNegative: true);
        $doesNotAllow = $this->makeComponent(allowNegative: false);
        $recipe = $this->makeRecipe($output);

        $this->addLine($recipe, $allowsNegative, 1.0);
        $this->addLine($recipe, $doesNotAllow, 2.0);

        $snapshot = $this->resolver->resolve($output->id);

        $withFlag = collect($snapshot->components)->firstWhere('component_id', $allowsNegative->id);
        $withoutFlag = collect($snapshot->components)->firstWhere('component_id', $doesNotAllow->id);

        $this->assertTrue($withFlag->allow_negative_stock);
        $this->assertFalse($withoutFlag->allow_negative_stock);
    }

    // ── 3. Resolver picks active version ──────────────────────────────────────

    public function test_resolver_returns_active_version_not_an_older_one(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();

        $v1 = $this->makeRecipe($output, isActive: false, version: 1);
        $v2 = $this->makeRecipe($output, isActive: true, version: 2);

        $this->addLine($v1, $component, 1.0);
        $this->addLine($v2, $component, 9.9);

        $snapshot = $this->resolver->resolve($output->id);

        $this->assertSame($v2->id, $snapshot->recipe_id);
        $this->assertSame(9.9, $snapshot->components[0]->quantity);
    }

    // ── 4. Exception: no active recipe ────────────────────────────────────────

    public function test_throws_when_product_has_no_active_recipe(): void
    {
        $output = $this->makeOutput();

        $this->expectException(RecipeResolverException::class);

        try {
            $this->resolver->resolve($output->id);
        } catch (RecipeResolverException $e) {
            $this->assertSame(RecipeResolverException::NO_ACTIVE_RECIPE, $e->reason());
            $this->assertSame($output->id, $e->context());
            throw $e;
        }
    }

    public function test_throws_when_only_inactive_recipes_exist(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $inactive = $this->makeRecipe($output, isActive: false);
        $this->addLine($inactive, $component);

        $this->expectException(RecipeResolverException::class);

        try {
            $this->resolver->resolve($output->id);
        } catch (RecipeResolverException $e) {
            $this->assertSame(RecipeResolverException::NO_ACTIVE_RECIPE, $e->reason());
            throw $e;
        }
    }

    // ── 5. Exception: recipe has no components ────────────────────────────────

    public function test_throws_when_recipe_has_no_components(): void
    {
        $output = $this->makeOutput();
        // Create active recipe with zero lines (bypasses HTTP validation)
        $this->makeRecipe($output, isActive: true);

        $this->expectException(RecipeResolverException::class);

        try {
            $this->resolver->resolve($output->id);
        } catch (RecipeResolverException $e) {
            $this->assertSame(RecipeResolverException::NO_COMPONENTS, $e->reason());
            throw $e;
        }
    }

    // ── 6. Exception: component product deleted ───────────────────────────────

    public function test_throws_when_component_product_is_soft_deleted(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component);

        // Soft-delete the component product
        $component->delete();

        $this->expectException(RecipeResolverException::class);

        try {
            $this->resolver->resolve($output->id);
        } catch (RecipeResolverException $e) {
            $this->assertSame(RecipeResolverException::COMPONENT_NOT_FOUND, $e->reason());
            $this->assertSame($component->id, $e->context());
            throw $e;
        }
    }

    // ── 7. Exception: component product inactive ──────────────────────────────

    public function test_throws_when_component_product_is_inactive(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent(active: false);
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component);

        $this->expectException(RecipeResolverException::class);

        try {
            $this->resolver->resolve($output->id);
        } catch (RecipeResolverException $e) {
            $this->assertSame(RecipeResolverException::COMPONENT_INACTIVE, $e->reason());
            $this->assertSame($component->sku, $e->context());
            throw $e;
        }
    }

    // ── 8. Exception: output product unavailable ──────────────────────────────

    public function test_throws_when_output_product_is_soft_deleted(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component);

        // Soft-delete the output product (FK is RESTRICT but soft-delete bypasses it)
        $output->delete();

        $this->expectException(RecipeResolverException::class);

        try {
            $this->resolver->resolve($output->id);
        } catch (RecipeResolverException $e) {
            $this->assertSame(RecipeResolverException::PRODUCT_UNAVAILABLE, $e->reason());
            throw $e;
        }
    }

    // ── 9. Snapshot immutability ──────────────────────────────────────────────

    public function test_snapshot_properties_are_readonly(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $this->addLine($this->makeRecipe($output), $component);

        $snapshot = $this->resolver->resolve($output->id);

        // Attempting to write to a readonly property must throw Error
        $this->expectException(Error::class);

        // @phpstan-ignore-next-line
        $snapshot->product_id = 'modified';
    }

    public function test_recipe_component_properties_are_readonly(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $this->addLine($this->makeRecipe($output), $component);

        $resolved = $this->resolver->resolve($output->id)->components[0];

        $this->expectException(Error::class);

        // @phpstan-ignore-next-line
        $resolved->quantity = 999.0;
    }

    // ── 10. toArray serialization ─────────────────────────────────────────────

    public function test_snapshot_to_array_contains_all_keys(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $this->addLine($this->makeRecipe($output), $component, 1.5);

        $arr = $this->resolver->resolve($output->id)->toArray();

        $this->assertArrayHasKey('recipe_id', $arr);
        $this->assertArrayHasKey('bom_number', $arr);
        $this->assertArrayHasKey('version', $arr);
        $this->assertArrayHasKey('bom_version_number', $arr);
        $this->assertArrayHasKey('product_id', $arr);
        $this->assertArrayHasKey('product_sku', $arr);
        $this->assertArrayHasKey('product_name', $arr);
        $this->assertArrayHasKey('components', $arr);
        $this->assertArrayHasKey('resolved_at', $arr);
    }

    public function test_snapshot_to_array_components_contain_all_keys(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $this->addLine($this->makeRecipe($output), $component, 2.0);

        $component_arr = $this->resolver->resolve($output->id)->toArray()['components'][0];

        $this->assertArrayHasKey('component_id', $component_arr);
        $this->assertArrayHasKey('sku', $component_arr);
        $this->assertArrayHasKey('name', $component_arr);
        $this->assertArrayHasKey('unit_id', $component_arr);
        $this->assertArrayHasKey('unit_name', $component_arr);
        $this->assertArrayHasKey('unit_symbol', $component_arr);
        $this->assertArrayHasKey('quantity', $component_arr);
        $this->assertArrayHasKey('allow_negative_stock', $component_arr);
    }

    // ── 11. Multiple component quantities ─────────────────────────────────────

    public function test_each_component_preserves_its_own_quantity(): void
    {
        $output = $this->makeOutput();
        $recipe = $this->makeRecipe($output);
        $c1 = $this->makeComponent();
        $c2 = $this->makeComponent();

        $this->addLine($recipe, $c1, 2.5);
        $this->addLine($recipe, $c2, 7.0);

        $snapshot = $this->resolver->resolve($output->id);
        $byId = collect($snapshot->components)->keyBy('component_id');

        $this->assertSame(2.5, $byId[$c1->id]->quantity);
        $this->assertSame(7.0, $byId[$c2->id]->quantity);
    }

    // ── 12. Resolver is read-only — no DB writes ──────────────────────────────

    public function test_resolver_does_not_modify_the_database(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 3.0);

        $countBefore = \Illuminate\Support\Facades\DB::table('bills_of_materials')->count();
        $linesBefore = \Illuminate\Support\Facades\DB::table('bill_of_material_lines')->count();

        $this->resolver->resolve($output->id);

        $this->assertSame($countBefore, \Illuminate\Support\Facades\DB::table('bills_of_materials')->count());
        $this->assertSame($linesBefore, \Illuminate\Support\Facades\DB::table('bill_of_material_lines')->count());
    }
}
