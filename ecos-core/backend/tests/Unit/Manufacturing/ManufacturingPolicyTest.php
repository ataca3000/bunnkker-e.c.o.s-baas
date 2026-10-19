<?php

declare(strict_types=1);

namespace Tests\Unit\Manufacturing;

use Modules\Manufacturing\ManufacturingPolicy\Domain\Enums\PolicyCode;
use Modules\Manufacturing\ManufacturingPolicy\Domain\Services\ManufacturingPolicy;
use Modules\Manufacturing\ManufacturingPolicy\Domain\ValueObjects\ManufacturingPolicyRequest;
use Modules\Manufacturing\ManufacturingPolicy\Domain\ValueObjects\ManufacturingPolicyResult;
use Modules\Manufacturing\ManufacturingPolicy\Domain\ValueObjects\OrderContext;
use Modules\Manufacturing\ManufacturingPolicy\Domain\ValueObjects\ProductContext;
use PHPUnit\Framework\TestCase;

/**
 * PKG-06B: ManufacturingPolicy — unit tests.
 *
 * Pure domain tests — no database, no Laravel container.
 * Each test verifies one policy rule or result structure invariant.
 *
 * Rule evaluation order tested:
 *   1. Order not cancelled
 *   2. Order status allows manufacturing
 *   3. Product can manufacture
 *   4. Recipe exists
 *   5. Product is inventory-managed
 *   6. Manufacturing required (qty > 0)
 *   7. Product not already manufactured
 */
class ManufacturingPolicyTest extends TestCase
{
    private ManufacturingPolicy $policy;

    protected function setUp(): void
    {
        parent::setUp();
        $this->policy = new ManufacturingPolicy;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function validRequest(float $qty = 5.0): ManufacturingPolicyRequest
    {
        return new ManufacturingPolicyRequest(
            product_id: 'product-uuid',
            required_qty: $qty,
            actor_id: 'actor-uuid',
        );
    }

    private function validOrder(string $status = 'pending', bool $alreadyManufactured = false): OrderContext
    {
        return new OrderContext(
            order_id: 'order-uuid',
            order_line_id: 'line-uuid',
            order_status: $status,
            is_cancelled: false,
            already_manufactured: $alreadyManufactured,
        );
    }

    private function validProduct(
        bool $canManufacture = true,
        bool $hasRecipe = true,
        bool $inventoryManaged = true,
    ): ProductContext {
        return new ProductContext(
            product_id: 'product-uuid',
            can_manufacture: $canManufacture,
            has_active_recipe: $hasRecipe,
            is_inventory_managed: $inventoryManaged,
        );
    }

    private function evaluate(
        ?ManufacturingPolicyRequest $request = null,
        ?OrderContext $order = null,
        ?ProductContext $product = null,
    ): ManufacturingPolicyResult {
        return $this->policy->evaluate(
            $request ?? $this->validRequest(),
            $order ?? $this->validOrder(),
            $product ?? $this->validProduct(),
        );
    }

    // ── Happy path ────────────────────────────────────────────────────────────

    public function test_returns_eligible_when_all_rules_pass(): void
    {
        $result = $this->evaluate();

        $this->assertTrue($result->eligible);
        $this->assertEquals(PolicyCode::Eligible, $result->policy_code);
        $this->assertEquals('eligible', $result->policy_code->value);
        $this->assertNotEmpty($result->reason);
    }

    public function test_eligible_when_order_status_is_pending(): void
    {
        $result = $this->evaluate(order: $this->validOrder(status: 'pending'));
        $this->assertTrue($result->eligible);
    }

    public function test_eligible_when_order_status_is_processing(): void
    {
        $result = $this->evaluate(order: $this->validOrder(status: 'processing'));
        $this->assertTrue($result->eligible);
    }

    // ── Rule 1: Order not cancelled ───────────────────────────────────────────

    public function test_ineligible_when_order_is_cancelled(): void
    {
        $order = new OrderContext(
            order_id: 'order-uuid',
            order_line_id: 'line-uuid',
            order_status: 'cancelled',
            is_cancelled: true,
            already_manufactured: false,
        );
        $result = $this->evaluate(order: $order);

        $this->assertFalse($result->eligible);
        $this->assertEquals(PolicyCode::OrderCancelled, $result->policy_code);
        $this->assertStringContainsString('cancelled', strtolower($result->reason));
    }

    public function test_cancellation_supersedes_all_other_rules(): void
    {
        // Even when every other flag is wrong, is_cancelled wins first
        $order = new OrderContext(
            order_id: 'order-uuid',
            order_line_id: 'line-uuid',
            order_status: 'completed', // would also fail rule 2
            is_cancelled: true,
            already_manufactured: true,        // would also fail rule 7
        );
        $product = $this->validProduct(canManufacture: false); // would also fail rule 3

        $result = $this->policy->evaluate($this->validRequest(), $order, $product);

        $this->assertEquals(PolicyCode::OrderCancelled, $result->policy_code);
    }

    // ── Rule 2: Order status allows manufacturing ─────────────────────────────

    public function test_ineligible_when_order_status_is_completed(): void
    {
        $result = $this->evaluate(order: $this->validOrder(status: 'completed'));

        $this->assertFalse($result->eligible);
        $this->assertEquals(PolicyCode::OrderStatusNotAllowed, $result->policy_code);
        $this->assertStringContainsString('completed', $result->reason);
    }

    public function test_ineligible_when_order_status_is_unknown(): void
    {
        $result = $this->evaluate(order: $this->validOrder(status: 'on_hold'));

        $this->assertFalse($result->eligible);
        $this->assertEquals(PolicyCode::OrderStatusNotAllowed, $result->policy_code);
        $this->assertStringContainsString('on_hold', $result->reason);
    }

    public function test_status_check_occurs_after_cancellation_check(): void
    {
        // Non-cancelled but disallowed status → rule 2, not rule 1
        $order = new OrderContext(
            order_id: 'order-uuid',
            order_line_id: 'line-uuid',
            order_status: 'completed',
            is_cancelled: false,
            already_manufactured: false,
        );
        $result = $this->evaluate(order: $order);

        $this->assertEquals(PolicyCode::OrderStatusNotAllowed, $result->policy_code);
    }

    // ── Rule 3: Product can manufacture ──────────────────────────────────────

    public function test_ineligible_when_product_cannot_manufacture(): void
    {
        $result = $this->evaluate(product: $this->validProduct(canManufacture: false));

        $this->assertFalse($result->eligible);
        $this->assertEquals(PolicyCode::ProductCannotManufacture, $result->policy_code);
        $this->assertStringContainsString('can_manufacture', $result->reason);
    }

    public function test_product_check_occurs_after_order_status_check(): void
    {
        // Disallowed status + non-manufacturable product → rule 2 fires first
        $result = $this->policy->evaluate(
            $this->validRequest(),
            $this->validOrder(status: 'completed'),
            $this->validProduct(canManufacture: false),
        );

        $this->assertEquals(PolicyCode::OrderStatusNotAllowed, $result->policy_code);
    }

    // ── Rule 4: Recipe exists ─────────────────────────────────────────────────

    public function test_ineligible_when_no_active_recipe(): void
    {
        $result = $this->evaluate(product: $this->validProduct(hasRecipe: false));

        $this->assertFalse($result->eligible);
        $this->assertEquals(PolicyCode::RecipeNotFound, $result->policy_code);
        $this->assertStringContainsString('recipe', strtolower($result->reason));
    }

    public function test_recipe_check_occurs_after_can_manufacture_check(): void
    {
        // can_manufacture=false AND no recipe → rule 3 fires first
        $result = $this->evaluate(product: $this->validProduct(canManufacture: false, hasRecipe: false));

        $this->assertEquals(PolicyCode::ProductCannotManufacture, $result->policy_code);
    }

    // ── Rule 5: Product is inventory-managed ─────────────────────────────────

    public function test_ineligible_when_product_not_inventory_managed(): void
    {
        $result = $this->evaluate(product: $this->validProduct(inventoryManaged: false));

        $this->assertFalse($result->eligible);
        $this->assertEquals(PolicyCode::ProductNotInventoryManaged, $result->policy_code);
        $this->assertStringContainsString('inventory', strtolower($result->reason));
    }

    public function test_inventory_managed_check_occurs_after_recipe_check(): void
    {
        // no recipe AND not inventory managed → rule 4 fires first
        $result = $this->evaluate(
            product: $this->validProduct(hasRecipe: false, inventoryManaged: false),
        );

        $this->assertEquals(PolicyCode::RecipeNotFound, $result->policy_code);
    }

    // ── Rule 6: Manufacturing required ────────────────────────────────────────

    public function test_ineligible_when_required_qty_is_zero(): void
    {
        $result = $this->evaluate(request: $this->validRequest(qty: 0.0));

        $this->assertFalse($result->eligible);
        $this->assertEquals(PolicyCode::ManufacturingNotRequired, $result->policy_code);
    }

    public function test_ineligible_when_required_qty_is_negative(): void
    {
        $result = $this->evaluate(request: $this->validRequest(qty: -1.0));

        $this->assertFalse($result->eligible);
        $this->assertEquals(PolicyCode::ManufacturingNotRequired, $result->policy_code);
    }

    public function test_qty_check_occurs_after_inventory_managed_check(): void
    {
        // not inventory managed AND qty=0 → rule 5 fires first
        $result = $this->policy->evaluate(
            $this->validRequest(qty: 0.0),
            $this->validOrder(),
            $this->validProduct(inventoryManaged: false),
        );

        $this->assertEquals(PolicyCode::ProductNotInventoryManaged, $result->policy_code);
    }

    // ── Rule 7: Product not already manufactured ──────────────────────────────

    public function test_ineligible_when_already_manufactured(): void
    {
        $result = $this->evaluate(order: $this->validOrder(alreadyManufactured: true));

        $this->assertFalse($result->eligible);
        $this->assertEquals(PolicyCode::AlreadyManufactured, $result->policy_code);
        $this->assertStringContainsString('already', strtolower($result->reason));
    }

    public function test_already_manufactured_is_last_rule(): void
    {
        // already_manufactured=true but qty=0 → rule 6 fires first
        $result = $this->policy->evaluate(
            $this->validRequest(qty: 0.0),
            $this->validOrder(alreadyManufactured: true),
            $this->validProduct(),
        );

        $this->assertEquals(PolicyCode::ManufacturingNotRequired, $result->policy_code);
    }

    // ── Result structure ──────────────────────────────────────────────────────

    public function test_result_eligible_factory_sets_correct_code(): void
    {
        $result = ManufacturingPolicyResult::eligible(['key' => 'value']);

        $this->assertTrue($result->eligible);
        $this->assertEquals(PolicyCode::Eligible, $result->policy_code);
        $this->assertTrue($result->policy_code->isEligible());
        $this->assertEquals(['key' => 'value'], $result->metadata);
    }

    public function test_result_ineligible_factory_sets_correct_code(): void
    {
        $result = ManufacturingPolicyResult::ineligible(
            code: PolicyCode::OrderCancelled,
            reason: 'Custom reason',
        );

        $this->assertFalse($result->eligible);
        $this->assertEquals(PolicyCode::OrderCancelled, $result->policy_code);
        $this->assertFalse($result->policy_code->isEligible());
        $this->assertEquals('Custom reason', $result->reason);
    }

    public function test_result_serializes_to_array_with_all_keys(): void
    {
        $result = $this->evaluate();
        $array = $result->toArray();

        $this->assertArrayHasKey('eligible', $array);
        $this->assertArrayHasKey('reason', $array);
        $this->assertArrayHasKey('policy_code', $array);
        $this->assertArrayHasKey('metadata', $array);
        $this->assertIsString($array['policy_code']);
        $this->assertEquals('eligible', $array['policy_code']);
    }

    public function test_ineligible_result_serializes_policy_code_as_string(): void
    {
        $result = $this->evaluate(order: $this->validOrder(status: 'completed'));
        $array = $result->toArray();

        $this->assertEquals('order_status_not_allowed', $array['policy_code']);
        $this->assertFalse($array['eligible']);
    }

    public function test_result_metadata_includes_product_and_order_context(): void
    {
        $result = $this->evaluate();

        $this->assertArrayHasKey('product_id', $result->metadata);
        $this->assertArrayHasKey('order_id', $result->metadata);
        $this->assertArrayHasKey('order_line_id', $result->metadata);
    }

    // ── PolicyCode enum ───────────────────────────────────────────────────────

    public function test_policy_code_eligible_is_the_only_eligible_code(): void
    {
        $eligibleCodes = array_filter(
            PolicyCode::cases(),
            fn (PolicyCode $c): bool => $c->isEligible(),
        );

        $this->assertCount(1, $eligibleCodes);
        $this->assertEquals(PolicyCode::Eligible, reset($eligibleCodes));
    }

    public function test_all_policy_codes_have_non_empty_labels(): void
    {
        foreach (PolicyCode::cases() as $code) {
            $this->assertNotEmpty($code->label(), "PolicyCode::{$code->name} has empty label");
        }
    }
}
