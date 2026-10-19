<?php

declare(strict_types=1);

namespace Tests\Feature\CostManagement;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\CostManagement\Domain\Enums\CostUpdateSource;
use Modules\CostManagement\Domain\Enums\PricingReviewStatus;
use Modules\CostManagement\Domain\Models\MaterialCostHistory;
use Modules\CostManagement\Domain\Models\PricingReview;
use Modules\CostManagement\Domain\Services\MaterialCostService;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\Recipe;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * TASK-COST-004 — Automatic Pricing Review Creation
 *
 * Verifies the full cascade:
 *   material_cost → recipe_cost → product_cost → PricingReview (Pending)
 */
class PricingReviewCascadeTest extends TestCase
{
    use RefreshDatabase;

    private Company $company;

    private MaterialCostService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->company = Company::factory()->create();
        $this->service = app(MaterialCostService::class);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Build a material → recipe → finished product chain.
     * Returns [material, finishedProduct, recipe].
     */
    private function makeChain(
        float $materialCost = 10.0,
        float $componentQty = 2.0,
        float $sellingPrice = 50.0,
        float $productCostNow = 20.0,
    ): array {
        $material = Product::factory()->rawMaterial()->create([
            'material_cost' => $materialCost,
        ]);

        $finished = Product::factory()->finishedGood()->manufacturable()->create([
            'regular_price' => $sellingPrice,
            'product_cost' => $productCostNow,
        ]);

        $recipe = Recipe::create([
            'bom_number' => 'BOM-TEST-'.uniqid(),
            'product_id' => $finished->id,
            'version' => '1.0',
            'bom_version_number' => 1,
            'is_active' => true,
        ]);

        $recipe->components()->create([
            'raw_material_id' => $material->id,
            'quantity' => $componentQty,
        ]);

        return [$material, $finished, $recipe];
    }

    // ── 1. Basic cascade: review created automatically ─────────────────────────

    public function test_pricing_review_created_after_manual_cost_update(): void
    {
        [$material, $finished] = $this->makeChain(
            materialCost: 10.0,
            componentQty: 2.0,
            productCostNow: 20.0,  // current before update
            sellingPrice: 50.0,
        );

        $this->service->update(
            material: $material,
            newCost: 15.0,   // new cost → recipe = 30, product_cost = 30
            source: CostUpdateSource::Manual,
            meta: ['company_id' => $this->company->id],
        );

        $this->assertDatabaseCount('pricing_reviews', 1);

        $review = PricingReview::query()->first();
        $this->assertNotNull($review);
        $this->assertSame($finished->id, $review->product_id);
        $this->assertSame($this->company->id, $review->company_id);
        $this->assertSame(PricingReviewStatus::Pending, $review->status);
        $this->assertEqualsWithDelta(20.0, (float) $review->previous_product_cost, 0.001);
        $this->assertEqualsWithDelta(30.0, (float) $review->product_cost, 0.001);
        $this->assertEqualsWithDelta(10.0, (float) $review->cost_difference, 0.001);
        $this->assertEqualsWithDelta(50.0, (float) $review->selling_price, 0.001);
        $this->assertContains('cost_increased', $review->impacts);
    }

    // ── 2. No review when product cost does not change ─────────────────────────

    public function test_no_review_created_when_product_cost_unchanged(): void
    {
        // componentQty=2, materialCost=10 → recipe_cost=20, product_cost=20
        [$material] = $this->makeChain(
            materialCost: 10.0,
            componentQty: 2.0,
            productCostNow: 20.0,
        );

        // Update material cost to same value — cascade recalculates to same product_cost
        $this->service->update(
            material: $material,
            newCost: 10.0,   // unchanged
            source: CostUpdateSource::Manual,
            meta: ['company_id' => $this->company->id],
        );

        $this->assertDatabaseCount('pricing_reviews', 0);
    }

    // ── 3. No review when material has no active recipe ────────────────────────

    public function test_no_review_created_when_material_has_no_recipe(): void
    {
        $material = Product::factory()->rawMaterial()->create([
            'material_cost' => 5.0,
        ]);

        $this->service->update(
            material: $material,
            newCost: 8.0,
            source: CostUpdateSource::Manual,
            meta: ['company_id' => $this->company->id],
        );

        $this->assertDatabaseCount('pricing_reviews', 0);
    }

    // ── 4. No duplicate review on second cost update ───────────────────────────

    public function test_existing_pending_review_is_updated_not_duplicated(): void
    {
        [$material, $finished] = $this->makeChain(
            materialCost: 10.0,
            componentQty: 2.0,
            productCostNow: 20.0,
            sellingPrice: 50.0,
        );

        // First update: 10 → 15, product_cost: 20 → 30
        $this->service->update(
            material: $material,
            newCost: 15.0,
            source: CostUpdateSource::Manual,
            meta: ['company_id' => $this->company->id],
        );

        $this->assertDatabaseCount('pricing_reviews', 1);
        $firstReviewId = PricingReview::query()->value('id');

        // Second update: 15 → 20, product_cost: 30 → 40
        $material->refresh();
        $this->service->update(
            material: $material,
            newCost: 20.0,
            source: CostUpdateSource::Manual,
            meta: ['company_id' => $this->company->id],
        );

        // Still exactly one review — updated in-place
        $this->assertDatabaseCount('pricing_reviews', 1);

        $review = PricingReview::query()->first();
        $this->assertSame($firstReviewId, $review->id);
        $this->assertSame(PricingReviewStatus::Pending, $review->status);
        // previous_cost preserved from the first update (original drift start)
        $this->assertEqualsWithDelta(20.0, (float) $review->previous_product_cost, 0.001);
        // product_cost updated to latest
        $this->assertEqualsWithDelta(40.0, (float) $review->product_cost, 0.001);
    }

    // ── 5. Resolved review triggers a NEW review on next cost change ───────────

    public function test_new_review_created_after_previous_one_was_resolved(): void
    {
        [$material] = $this->makeChain(
            materialCost: 10.0,
            componentQty: 2.0,
            productCostNow: 20.0,
            sellingPrice: 50.0,
        );

        // First cascade
        $this->service->update(
            material: $material,
            newCost: 15.0,
            source: CostUpdateSource::Manual,
            meta: ['company_id' => $this->company->id],
        );

        // Approve the review (mark as resolved)
        PricingReview::query()->first()->resolve(PricingReviewStatus::Approved);

        $this->assertDatabaseCount('pricing_reviews', 1);

        // Second cascade — should create a new review, not update the resolved one
        $material->refresh();
        $this->service->update(
            material: $material,
            newCost: 20.0,
            source: CostUpdateSource::Manual,
            meta: ['company_id' => $this->company->id],
        );

        $this->assertDatabaseCount('pricing_reviews', 2);

        $pending = PricingReview::query()
            ->where('status', PricingReviewStatus::Pending->value)
            ->first();

        $this->assertNotNull($pending);
        $this->assertEqualsWithDelta(40.0, (float) $pending->product_cost, 0.001);
    }

    // ── 6. company_id falls back to first company in DB ───────────────────────

    public function test_company_id_falls_back_to_first_company_when_not_in_meta(): void
    {
        [$material] = $this->makeChain(
            materialCost: 10.0,
            componentQty: 2.0,
            productCostNow: 20.0,
        );

        // No company_id in meta — should fall back to $this->company (only one in DB)
        $this->service->update(
            material: $material,
            newCost: 15.0,
            source: CostUpdateSource::Manual,
            meta: [],
        );

        $this->assertDatabaseCount('pricing_reviews', 1);
        $this->assertSame($this->company->id, PricingReview::query()->value('company_id'));
    }

    // ── 7. material_cost_history linked to review ─────────────────────────────

    public function test_review_is_linked_to_triggering_cost_history_record(): void
    {
        [$material] = $this->makeChain(
            materialCost: 10.0,
            componentQty: 2.0,
            productCostNow: 20.0,
        );

        $this->service->update(
            material: $material,
            newCost: 15.0,
            source: CostUpdateSource::Manual,
            meta: ['company_id' => $this->company->id],
        );

        $history = MaterialCostHistory::query()->first();
        $review = PricingReview::query()->first();

        $this->assertNotNull($history);
        $this->assertNotNull($review);
        $this->assertSame($history->id, $review->triggered_by_cost_history_id);
    }

    // ── 8. impact flags set correctly ─────────────────────────────────────────

    public function test_cost_decreased_impact_flag_when_cost_goes_down(): void
    {
        [$material] = $this->makeChain(
            materialCost: 20.0,
            componentQty: 2.0,
            productCostNow: 40.0,
            sellingPrice: 50.0,  // healthy margin at 40 cost = 20% margin
        );

        $this->service->update(
            material: $material,
            newCost: 10.0,  // decrease → product_cost: 40 → 20
            source: CostUpdateSource::Manual,
            meta: ['company_id' => $this->company->id],
        );

        $review = PricingReview::query()->first();
        $this->assertNotNull($review);
        $this->assertContains('cost_decreased', $review->impacts);
        $this->assertNotContains('cost_increased', $review->impacts);
    }

    // ── 9. margin_below_target flag when margin drops under 30% ───────────────

    public function test_margin_below_target_flag_set_correctly(): void
    {
        // selling = 30, product_cost after cascade will be 30 → margin = 0%
        [$material] = $this->makeChain(
            materialCost: 5.0,
            componentQty: 2.0,
            productCostNow: 10.0,
            sellingPrice: 30.0,
        );

        // new material_cost = 15 → recipe_cost = 30 → product_cost = 30
        // margin = (30 - 30) / 30 * 100 = 0%, below 30% target
        $this->service->update(
            material: $material,
            newCost: 15.0,
            source: CostUpdateSource::Manual,
            meta: ['company_id' => $this->company->id],
        );

        $review = PricingReview::query()->first();
        $this->assertNotNull($review);
        $this->assertContains('margin_below_target', $review->impacts);
    }
}
