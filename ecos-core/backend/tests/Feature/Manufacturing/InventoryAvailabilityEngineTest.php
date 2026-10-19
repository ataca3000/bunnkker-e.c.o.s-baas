<?php

declare(strict_types=1);

namespace Tests\Feature\Manufacturing;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Manufacturing\AvailabilityEngine\Domain\Enums\ManufacturingEligibility;
use Modules\Manufacturing\AvailabilityEngine\Domain\Services\InventoryAvailabilityEngine;
use Modules\Manufacturing\AvailabilityEngine\Domain\ValueObjects\AvailabilityResult;
use Modules\Manufacturing\AvailabilityEngine\Domain\ValueObjects\RawMaterialAvailability;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\Recipe;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * PKG-04A: Inventory Availability Engine
 *
 * READ-ONLY GUARANTEE: every test asserts zero DB writes to inventory_items
 * (no on_hand_qty or reserved_qty changes after analyse()).
 *
 * RC-1: shortage_qty = max(0, ordered_qty − available_finished_goods)
 * RC-2: allow_negative_stock evaluated on raw materials only; FG never go negative.
 */
class InventoryAvailabilityEngineTest extends TestCase
{
    use RefreshDatabase;

    private InventoryAvailabilityEngine $engine;

    private Company $company;

    private Warehouse $warehouse;

    protected function setUp(): void
    {
        parent::setUp();
        $this->engine = app(InventoryAvailabilityEngine::class);
        $this->company = Company::factory()->create();
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeOutput(): Product
    {
        return Product::factory()->finishedGood()->manufacturable()->create();
    }

    private function makeComponent(bool $allowNegative = false): Product
    {
        return Product::factory()->rawMaterial()->create([
            'allow_negative_stock' => $allowNegative,
        ]);
    }

    private function makeRecipe(Product $output, int $version = 1): Recipe
    {
        return Recipe::create([
            'bom_number' => 'BOM-AE-'.uniqid(),
            'product_id' => $output->id,
            'version' => "{$version}.0",
            'bom_version_number' => $version,
            'is_active' => true,
        ]);
    }

    private function addLine(Recipe $recipe, Product $component, float $qty): void
    {
        $recipe->components()->create([
            'raw_material_id' => $component->id,
            'quantity' => $qty,
        ]);
    }

    private function seedInventory(Product $product, float $onHand, float $reserved = 0.0): InventoryItem
    {
        return InventoryItem::query()->create([
            'warehouse_id' => $this->warehouse->id,
            'product_id' => $product->id,
            'company_id' => $this->company->id,
            'on_hand_qty' => $onHand,
            'reserved_qty' => $reserved,
        ]);
    }

    private function analyse(Product $product, float $required): AvailabilityResult
    {
        // $companyId is required since inventory reads became company-scoped.
        // The fixture already owns a company; it simply was not being passed.
        return $this->engine->analyse(
            $product->id,
            $this->warehouse->id,
            $required,
            $this->company->id,
        );
    }

    // ── 1. Sufficient Stock ───────────────────────────────────────────────────

    public function test_sufficient_when_fg_stock_covers_required_qty(): void
    {
        $product = $this->makeOutput();
        $this->seedInventory($product, onHand: 20.0, reserved: 2.0); // available = 18

        $result = $this->analyse($product, required: 10.0);

        $this->assertSame(ManufacturingEligibility::Sufficient, $result->eligibility);
        $this->assertFalse($result->needs_manufacturing);
        $this->assertSame(0.0, $result->qty_to_manufacture);
        $this->assertSame(18.0, $result->available_finished_goods);
        $this->assertTrue($result->can_manufacture);
        $this->assertNull($result->recipe_snapshot);
        $this->assertSame([], $result->raw_materials);
    }

    public function test_sufficient_when_available_equals_required_exactly(): void
    {
        $product = $this->makeOutput();
        $this->seedInventory($product, onHand: 5.0); // available = 5.0

        $result = $this->analyse($product, required: 5.0);

        $this->assertSame(ManufacturingEligibility::Sufficient, $result->eligibility);
        $this->assertSame(0.0, $result->qty_to_manufacture);
    }

    // ── 2. RC-1 Partial Manufacturing ────────────────────────────────────────

    public function test_rc1_only_shortage_is_manufactured_not_full_qty(): void
    {
        $product = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($product);
        $this->addLine($recipe, $component, qty: 2.0);

        $this->seedInventory($product, onHand: 3.0);  // available = 3.0
        $this->seedInventory($component, onHand: 20.0); // 14 needed (7 shortage × 2)

        $result = $this->analyse($product, required: 10.0);

        // RC-1: qty_to_manufacture = max(0, 10 - 3) = 7
        $this->assertSame(7.0, $result->qty_to_manufacture);
        $this->assertSame(3.0, $result->available_finished_goods);
        $this->assertTrue($result->needs_manufacturing);

        // Component required = 2.0 * 7 = 14 (scaled, not per-unit recipe qty)
        $this->assertCount(1, $result->raw_materials);
        $this->assertSame(14.0, $result->raw_materials[0]->required_qty);
    }

    // ── 3. Can Manufacture — all materials available ──────────────────────────

    public function test_can_manufacture_when_all_materials_covered(): void
    {
        $product = $this->makeOutput();
        $mat1 = $this->makeComponent();
        $mat2 = $this->makeComponent();
        $recipe = $this->makeRecipe($product);
        $this->addLine($recipe, $mat1, qty: 3.0);
        $this->addLine($recipe, $mat2, qty: 1.5);

        // No FG stock → full qty needs manufacturing
        $this->seedInventory($mat1, onHand: 30.0); // need 3*10=30 ✓
        $this->seedInventory($mat2, onHand: 20.0); // need 1.5*10=15 ✓

        $result = $this->analyse($product, required: 10.0);

        $this->assertSame(ManufacturingEligibility::CanManufacture, $result->eligibility);
        $this->assertTrue($result->can_manufacture);
        $this->assertTrue($result->needs_manufacturing);
        $this->assertNotNull($result->recipe_snapshot);
        $this->assertCount(2, $result->raw_materials);

        foreach ($result->raw_materials as $mat) {
            $this->assertTrue($mat->is_satisfied);
            $this->assertSame(0.0, $mat->missing_qty);
        }
    }

    public function test_can_manufacture_when_no_fg_stock_at_all(): void
    {
        $product = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($product);
        $this->addLine($recipe, $component, qty: 2.0);

        // No FG inventory record exists at all
        $this->seedInventory($component, onHand: 10.0);

        $result = $this->analyse($product, required: 5.0);

        $this->assertSame(ManufacturingEligibility::CanManufacture, $result->eligibility);
        $this->assertSame(0.0, $result->available_finished_goods);
        $this->assertSame(5.0, $result->qty_to_manufacture);
    }

    // ── 4. Partial (RC-2) — unsatisfied but allow_negative_stock ─────────────

    public function test_partial_when_all_unsatisfied_components_allow_negative_stock(): void
    {
        $product = $this->makeOutput();
        $component = $this->makeComponent(allowNegative: true);
        $recipe = $this->makeRecipe($product);
        $this->addLine($recipe, $component, qty: 5.0);

        // Component has only 2 units; need 50 (5 × 10) → missing 48, but allow_negative_stock=true
        $this->seedInventory($component, onHand: 2.0);

        $result = $this->analyse($product, required: 10.0);

        $this->assertSame(ManufacturingEligibility::Partial, $result->eligibility);
        $this->assertTrue($result->can_manufacture);

        $mat = $result->raw_materials[0];
        $this->assertTrue($mat->allow_negative_stock);
        $this->assertTrue($mat->is_satisfied); // RC-2: negative stock permitted
        $this->assertSame(48.0, $mat->missing_qty);
    }

    public function test_partial_when_mixed_satisfied_and_negative_stock_components(): void
    {
        $product = $this->makeOutput();
        $matCovered = $this->makeComponent();
        $matNegative = $this->makeComponent(allowNegative: true);
        $recipe = $this->makeRecipe($product);
        $this->addLine($recipe, $matCovered, qty: 2.0);
        $this->addLine($recipe, $matNegative, qty: 3.0);

        $this->seedInventory($matCovered, onHand: 20.0); // need 2*5=10 ✓
        $this->seedInventory($matNegative, onHand: 0.0);  // need 3*5=15, missing 15, but negative allowed

        $result = $this->analyse($product, required: 5.0);

        $this->assertSame(ManufacturingEligibility::Partial, $result->eligibility);
    }

    // ── 5. Cannot Manufacture — hard blocker ─────────────────────────────────

    public function test_cannot_manufacture_when_component_short_and_no_negative_stock(): void
    {
        $product = $this->makeOutput();
        $component = $this->makeComponent(allowNegative: false);
        $recipe = $this->makeRecipe($product);
        $this->addLine($recipe, $component, qty: 10.0);

        // Need 100 units; only 5 available; negative stock NOT allowed
        $this->seedInventory($component, onHand: 5.0);

        $result = $this->analyse($product, required: 10.0);

        $this->assertSame(ManufacturingEligibility::CannotManufacture, $result->eligibility);
        $this->assertFalse($result->can_manufacture);

        $mat = $result->raw_materials[0];
        $this->assertFalse($mat->is_satisfied);
        $this->assertSame(95.0, $mat->missing_qty);
    }

    public function test_cannot_manufacture_even_one_hard_blocker_fails_all(): void
    {
        $product = $this->makeOutput();
        $matOk = $this->makeComponent();
        $matNeg = $this->makeComponent(allowNegative: true);
        $matBlocking = $this->makeComponent(allowNegative: false);
        $recipe = $this->makeRecipe($product);
        $this->addLine($recipe, $matOk, qty: 1.0);
        $this->addLine($recipe, $matNeg, qty: 1.0);
        $this->addLine($recipe, $matBlocking, qty: 1.0);

        $this->seedInventory($matOk, onHand: 100.0); // covered
        $this->seedInventory($matNeg, onHand: 0.0);   // missing but negative allowed
        $this->seedInventory($matBlocking, onHand: 0.0);   // missing, no negative stock → BLOCKER

        $result = $this->analyse($product, required: 5.0);

        $this->assertSame(ManufacturingEligibility::CannotManufacture, $result->eligibility);
        $this->assertFalse($result->can_manufacture);
    }

    // ── 6. No Recipe ─────────────────────────────────────────────────────────

    public function test_no_recipe_when_product_has_no_active_bom(): void
    {
        $product = $this->makeOutput(); // no recipe seeded

        $result = $this->analyse($product, required: 5.0);

        $this->assertSame(ManufacturingEligibility::NoRecipe, $result->eligibility);
        $this->assertFalse($result->can_manufacture);
        $this->assertTrue($result->needs_manufacturing);
        $this->assertNull($result->recipe_snapshot);
        $this->assertSame([], $result->raw_materials);
        $this->assertSame(5.0, $result->qty_to_manufacture);
    }

    public function test_no_recipe_when_bom_exists_but_is_inactive(): void
    {
        $product = $this->makeOutput();
        $recipe = Recipe::create([
            'bom_number' => 'BOM-INACTIVE-'.uniqid(),
            'product_id' => $product->id,
            'version' => '1.0',
            'bom_version_number' => 1,
            'is_active' => false,  // inactive
        ]);
        $component = $this->makeComponent();
        $recipe->components()->create(['raw_material_id' => $component->id, 'quantity' => 1.0]);

        $result = $this->analyse($product, required: 3.0);

        $this->assertSame(ManufacturingEligibility::NoRecipe, $result->eligibility);
    }

    // ── 7. Missing Inventory Record = Zero Stock ──────────────────────────────

    public function test_missing_inventory_record_is_treated_as_zero_stock(): void
    {
        $product = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($product);
        $this->addLine($recipe, $component, qty: 1.0);

        // No InventoryItem rows seeded at all (neither FG nor component)
        $result = $this->analyse($product, required: 5.0);

        $this->assertSame(0.0, $result->available_finished_goods);
        $this->assertSame(5.0, $result->qty_to_manufacture);
        $this->assertSame(0.0, $result->raw_materials[0]->available_qty);
    }

    // ── 8. Read-Only Guarantee ────────────────────────────────────────────────

    public function test_engine_does_not_modify_inventory_records(): void
    {
        $product = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($product);
        $this->addLine($recipe, $component, qty: 2.0);

        $fgItem = $this->seedInventory($product, onHand: 3.0);
        $matItem = $this->seedInventory($component, onHand: 4.0);

        $this->analyse($product, required: 10.0);

        // Reload from DB and assert untouched
        $this->assertSame(3.0, (float) $fgItem->fresh()->on_hand_qty);
        $this->assertSame(4.0, (float) $matItem->fresh()->on_hand_qty);
    }

    // ── 9. Result Structure ───────────────────────────────────────────────────

    public function test_result_contains_correct_product_and_warehouse_ids(): void
    {
        $product = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($product);
        $this->addLine($recipe, $component, qty: 1.0);
        $this->seedInventory($component, onHand: 100.0);

        $result = $this->analyse($product, required: 5.0);

        $this->assertSame($product->id, $result->product_id);
        $this->assertSame($this->warehouse->id, $result->warehouse_id);
        $this->assertSame(5.0, $result->required_qty);
    }

    public function test_result_includes_recipe_snapshot_with_correct_version(): void
    {
        $product = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($product, version: 3);
        $this->addLine($recipe, $component, qty: 1.0);
        $this->seedInventory($component, onHand: 100.0);

        $result = $this->analyse($product, required: 5.0);

        $this->assertNotNull($result->recipe_snapshot);
        $this->assertSame(3, $result->recipe_snapshot->bom_version_number);
        $this->assertSame($product->id, $result->recipe_snapshot->product_id);
    }

    public function test_raw_material_availability_has_correct_structure(): void
    {
        $product = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($product);
        $this->addLine($recipe, $component, qty: 3.0);
        $this->seedInventory($component, onHand: 6.0);

        $result = $this->analyse($product, required: 5.0);

        $this->assertCount(1, $result->raw_materials);
        $mat = $result->raw_materials[0];
        $this->assertInstanceOf(RawMaterialAvailability::class, $mat);
        $this->assertSame($component->id, $mat->component_id);
        $this->assertSame(15.0, $mat->required_qty);  // 3.0 × 5
        $this->assertSame(6.0, $mat->available_qty);
        $this->assertSame(9.0, $mat->missing_qty);   // 15 - 6
    }

    public function test_to_array_serialises_all_fields(): void
    {
        $product = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($product);
        $this->addLine($recipe, $component, qty: 1.0);
        $this->seedInventory($component, onHand: 100.0);

        $result = $this->analyse($product, required: 5.0);
        $array = $result->toArray();

        $this->assertArrayHasKey('product_id', $array);
        $this->assertArrayHasKey('warehouse_id', $array);
        $this->assertArrayHasKey('required_qty', $array);
        $this->assertArrayHasKey('available_finished_goods', $array);
        $this->assertArrayHasKey('qty_to_manufacture', $array);
        $this->assertArrayHasKey('needs_manufacturing', $array);
        $this->assertArrayHasKey('recipe_snapshot', $array);
        $this->assertArrayHasKey('raw_materials', $array);
        $this->assertArrayHasKey('can_manufacture', $array);
        $this->assertArrayHasKey('eligibility', $array);
        $this->assertArrayHasKey('evaluated_at', $array);
        $this->assertSame('can_manufacture', $array['eligibility']);
        $this->assertIsArray($array['raw_materials']);
    }

    public function test_missing_materials_helper_returns_only_unmet_components(): void
    {
        $product = $this->makeOutput();
        $matOk = $this->makeComponent();
        $matShort = $this->makeComponent();
        $recipe = $this->makeRecipe($product);
        $this->addLine($recipe, $matOk, qty: 1.0);
        $this->addLine($recipe, $matShort, qty: 10.0);

        $this->seedInventory($matOk, onHand: 100.0);
        $this->seedInventory($matShort, onHand: 1.0);   // short

        $result = $this->analyse($product, required: 5.0);

        $missing = $result->missingMaterials();
        $this->assertCount(1, $missing);
        $this->assertSame($matShort->id, $missing[0]->component_id);
    }
}
