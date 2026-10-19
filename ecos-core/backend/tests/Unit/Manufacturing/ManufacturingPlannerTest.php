<?php

declare(strict_types=1);

namespace Tests\Unit\Manufacturing;

use DateTimeImmutable;
use DateTimeInterface;
use Modules\Manufacturing\AvailabilityEngine\Domain\Enums\ManufacturingEligibility;
use Modules\Manufacturing\AvailabilityEngine\Domain\ValueObjects\AvailabilityResult;
use Modules\Manufacturing\AvailabilityEngine\Domain\ValueObjects\RawMaterialAvailability;
use Modules\Manufacturing\BillsOfMaterials\Domain\ValueObjects\RecipeComponent;
use Modules\Manufacturing\BillsOfMaterials\Domain\ValueObjects\RecipeSnapshot;
use Modules\Manufacturing\DecisionKernel\Domain\Enums\DecisionType;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionContext;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionEvaluation;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionReason;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionResult;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionTrigger;
use Modules\Manufacturing\ManufacturingPlanner\Domain\Exceptions\PlannerException;
use Modules\Manufacturing\ManufacturingPlanner\Domain\Services\ManufacturingPlanner;
use Modules\Manufacturing\ManufacturingPlanner\Domain\ValueObjects\ManufacturingPlan;
use PHPUnit\Framework\TestCase;

/**
 * PKG-04B: ManufacturingPlanner — pure unit tests.
 *
 * No database, no Laravel boot, no infrastructure.
 * All inputs are constructed directly from value objects.
 */
class ManufacturingPlannerTest extends TestCase
{
    private ManufacturingPlanner $planner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->planner = new ManufacturingPlanner;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeDecision(
        DecisionType $type = DecisionType::Approve,
        string $reasonCode = 'mfg_approved',
        string $triggerType = 'order_line',
        string $triggerId = 'order-123',
        int $triggerVersion = 1,
        ?string $actorId = null,
    ): DecisionResult {
        $reason = new DecisionReason(code: $reasonCode, message: 'Test decision');

        return new DecisionResult(
            decision: $type,
            reason: $reason,
            matched_rule: new DecisionEvaluation(
                rule_id: 'rule-001',
                rule_name: 'Test Rule',
                priority: 100,
                matched: true,
                decision_type: $type,
                reason: $reason,
            ),
            context: new DecisionContext('manufacturing'),
            trigger: new DecisionTrigger(
                trigger_type: $triggerType,
                trigger_id: $triggerId,
                trigger_version: $triggerVersion,
                triggered_at: (new DateTimeImmutable)->format(DateTimeInterface::ATOM),
                actor_id: $actorId,
            ),
            decided_at: (new DateTimeImmutable)->format(DateTimeInterface::ATOM),
        );
    }

    private function makeSnapshot(
        string $productId = 'prod-001',
        string $sku = 'SKU-FG-001',
        string $name = 'Finished Product A',
        int $version = 1,
        array $components = [],
    ): RecipeSnapshot {
        return new RecipeSnapshot(
            recipe_id: 'recipe-'.uniqid(),
            bom_number: 'BOM-001',
            version: "{$version}.0",
            bom_version_number: $version,
            product_id: $productId,
            product_sku: $sku,
            product_name: $name,
            components: $components,
            resolved_at: (new DateTimeImmutable)->format(DateTimeInterface::ATOM),
        );
    }

    private function makeComponent(
        string $id = 'comp-001',
        string $sku = 'SKU-RM-001',
        float $qty = 2.0,
        bool $allowNegative = false,
    ): RecipeComponent {
        return new RecipeComponent(
            component_id: $id,
            sku: $sku,
            name: "Component {$sku}",
            unit_id: 'unit-001',
            unit_name: 'Kilogram',
            unit_symbol: 'kg',
            quantity: $qty,
            allow_negative_stock: $allowNegative,
        );
    }

    private function makeRawMaterial(
        string $componentId = 'comp-001',
        string $sku = 'SKU-RM-001',
        float $requiredQty = 10.0,
        float $availableQty = 10.0,
        bool $allowNegative = false,
    ): RawMaterialAvailability {
        $missingQty = max(0.0, $requiredQty - $availableQty);
        $isSatisfied = $missingQty === 0.0 || $allowNegative;

        return new RawMaterialAvailability(
            component_id: $componentId,
            sku: $sku,
            name: "Component {$sku}",
            unit_symbol: 'kg',
            required_qty: $requiredQty,
            available_qty: $availableQty,
            missing_qty: $missingQty,
            allow_negative_stock: $allowNegative,
            is_satisfied: $isSatisfied,
        );
    }

    private function makeAvailability(
        string $productId = 'prod-001',
        float $requiredQty = 10.0,
        float $availableFg = 0.0,
        float $qtyToManufacture = 10.0,
        bool $needsManufacturing = true,
        ?RecipeSnapshot $snapshot = null,
        array $rawMaterials = [],
        bool $canManufacture = true,
        ManufacturingEligibility $eligibility = ManufacturingEligibility::CanManufacture,
    ): AvailabilityResult {
        return new AvailabilityResult(
            product_id: $productId,
            warehouse_id: 'wh-001',
            required_qty: $requiredQty,
            available_finished_goods: $availableFg,
            qty_to_manufacture: $qtyToManufacture,
            needs_manufacturing: $needsManufacturing,
            recipe_snapshot: $snapshot,
            raw_materials: $rawMaterials,
            can_manufacture: $canManufacture,
            eligibility: $eligibility,
            evaluated_at: (new DateTimeImmutable)->format(DateTimeInterface::ATOM),
        );
    }

    private function plan(AvailabilityResult $availability, ?DecisionResult $decision = null): ManufacturingPlan
    {
        return $this->planner->plan($availability, $decision ?? $this->makeDecision());
    }

    // ── 1. Full Manufacture ───────────────────────────────────────────────────

    public function test_full_manufacture_plan_when_can_manufacture_and_approved(): void
    {
        $snapshot = $this->makeSnapshot();
        $rawMaterial = $this->makeRawMaterial(requiredQty: 20.0, availableQty: 20.0);
        $availability = $this->makeAvailability(
            snapshot: $snapshot,
            rawMaterials: [$rawMaterial],
            eligibility: ManufacturingEligibility::CanManufacture,
        );

        $plan = $this->plan($availability);

        $this->assertTrue($plan->can_proceed);
        $this->assertTrue($plan->should_manufacture);
        $this->assertSame(ManufacturingEligibility::CanManufacture, $plan->eligibility);
        $this->assertSame(DecisionType::Approve, $plan->decision_type);
        $this->assertCount(1, $plan->components);
        $this->assertSame([], $plan->negative_stock_decisions);
        $this->assertFalse($plan->hasNegativeStockRisk());
    }

    public function test_finished_goods_to_produce_equals_qty_to_manufacture(): void
    {
        $snapshot = $this->makeSnapshot();
        $availability = $this->makeAvailability(
            qtyToManufacture: 7.0,
            snapshot: $snapshot,
            rawMaterials: [$this->makeRawMaterial(requiredQty: 14.0, availableQty: 14.0)],
        );

        $plan = $this->plan($availability);

        $this->assertSame(7.0, $plan->qty_to_manufacture);
        $this->assertSame(7.0, $plan->finished_goods_to_produce);
    }

    // ── 2. RC-1 Partial Manufacture ──────────────────────────────────────────

    public function test_rc1_only_shortage_quantity_in_plan(): void
    {
        // FG available = 3, required = 10 → shortage = 7 → RC-1
        $snapshot = $this->makeSnapshot();
        $rawMaterial = $this->makeRawMaterial(requiredQty: 14.0, availableQty: 20.0); // scaled by 7
        $availability = $this->makeAvailability(
            requiredQty: 10.0,
            availableFg: 3.0,
            qtyToManufacture: 7.0,  // RC-1: max(0, 10 - 3)
            snapshot: $snapshot,
            rawMaterials: [$rawMaterial],
        );

        $plan = $this->plan($availability);

        $this->assertSame(7.0, $plan->qty_to_manufacture);
        $this->assertSame(3.0, $plan->available_finished_goods);
        $this->assertSame(14.0, $plan->components[0]->qty_to_consume);
    }

    // ── 3. Sufficient Stock ───────────────────────────────────────────────────

    public function test_sufficient_stock_no_manufacture_required(): void
    {
        $availability = $this->makeAvailability(
            requiredQty: 5.0,
            availableFg: 10.0,
            qtyToManufacture: 0.0,
            needsManufacturing: false,
            canManufacture: true,
            eligibility: ManufacturingEligibility::Sufficient,
        );

        $plan = $this->plan($availability);

        $this->assertFalse($plan->should_manufacture);
        $this->assertTrue($plan->can_proceed); // can proceed with fulfillment
        $this->assertSame(0.0, $plan->qty_to_manufacture);
        $this->assertSame(ManufacturingEligibility::Sufficient, $plan->eligibility);
        $this->assertSame([], $plan->components);
        $this->assertNull($plan->recipe_id);
        $this->assertNull($plan->recipe_snapshot_hash);
    }

    // ── 4. No Manufacture When Deferred ──────────────────────────────────────

    public function test_can_proceed_false_when_decision_deferred(): void
    {
        $snapshot = $this->makeSnapshot();
        $availability = $this->makeAvailability(
            snapshot: $snapshot,
            rawMaterials: [$this->makeRawMaterial(requiredQty: 10.0, availableQty: 10.0)],
        );
        $decision = $this->makeDecision(DecisionType::Defer, reasonCode: 'deferred_insufficient_context');

        $plan = $this->planner->plan($availability, $decision);

        $this->assertFalse($plan->can_proceed);
        $this->assertFalse($plan->should_manufacture);
        $this->assertSame(DecisionType::Defer, $plan->decision_type);
    }

    public function test_can_proceed_false_when_decision_escalated(): void
    {
        $snapshot = $this->makeSnapshot();
        $availability = $this->makeAvailability(
            snapshot: $snapshot,
            rawMaterials: [$this->makeRawMaterial(requiredQty: 10.0, availableQty: 10.0)],
        );

        $plan = $this->planner->plan(
            $availability,
            $this->makeDecision(DecisionType::Escalate),
        );

        $this->assertFalse($plan->can_proceed);
        $this->assertFalse($plan->should_manufacture);
    }

    // ── 5. No Recipe ─────────────────────────────────────────────────────────

    public function test_no_recipe_plan_has_no_components_and_cannot_proceed(): void
    {
        $availability = $this->makeAvailability(
            qtyToManufacture: 5.0,
            needsManufacturing: true,
            canManufacture: false,
            eligibility: ManufacturingEligibility::NoRecipe,
        );
        $decision = $this->makeDecision(DecisionType::Reject, reasonCode: 'no_active_recipe');

        $plan = $this->planner->plan($availability, $decision);

        $this->assertFalse($plan->can_proceed);
        $this->assertFalse($plan->should_manufacture);
        $this->assertSame(ManufacturingEligibility::NoRecipe, $plan->eligibility);
        $this->assertNull($plan->recipe_id);
        $this->assertNull($plan->recipe_snapshot_hash);
        $this->assertSame([], $plan->components);
        $this->assertSame([], $plan->negative_stock_decisions);
    }

    // ── 6. Blocked By Availability ────────────────────────────────────────────

    public function test_blocked_plan_when_cannot_manufacture(): void
    {
        $snapshot = $this->makeSnapshot(components: [$this->makeComponent(allowNegative: false)]);
        $rawMaterial = $this->makeRawMaterial(
            requiredQty: 10.0,
            availableQty: 2.0,    // short by 8, no negative stock
            allowNegative: false,
        );
        $availability = $this->makeAvailability(
            canManufacture: false,
            eligibility: ManufacturingEligibility::CannotManufacture,
            snapshot: $snapshot,
            rawMaterials: [$rawMaterial],
        );
        $decision = $this->makeDecision(DecisionType::Reject, reasonCode: 'insufficient_raw_materials');

        $plan = $this->planner->plan($availability, $decision);

        $this->assertFalse($plan->can_proceed);
        $this->assertFalse($plan->should_manufacture);

        $this->assertCount(1, $plan->components);
        $this->assertTrue($plan->components[0]->is_blocked);
        $this->assertFalse($plan->components[0]->will_go_negative);

        $blocked = $plan->blockedComponents();
        $this->assertCount(1, $blocked);
    }

    public function test_blocked_components_helper_excludes_covered_components(): void
    {
        $snapshot = $this->makeSnapshot();
        $covered = $this->makeRawMaterial('comp-a', 'SKU-A', requiredQty: 5.0, availableQty: 10.0);
        $blocked = $this->makeRawMaterial('comp-b', 'SKU-B', requiredQty: 10.0, availableQty: 2.0, allowNegative: false);

        $availability = $this->makeAvailability(
            canManufacture: false,
            eligibility: ManufacturingEligibility::CannotManufacture,
            snapshot: $snapshot,
            rawMaterials: [$covered, $blocked],
        );

        $plan = $this->planner->plan($availability, $this->makeDecision(DecisionType::Reject));

        $this->assertCount(2, $plan->components);
        $this->assertCount(1, $plan->blockedComponents());
        $this->assertSame('SKU-B', $plan->blockedComponents()[0]->sku);
    }

    // ── 7. Negative Stock (RC-2) ──────────────────────────────────────────────

    public function test_partial_plan_with_negative_stock_decisions(): void
    {
        $snapshot = $this->makeSnapshot();
        $rawMaterial = $this->makeRawMaterial(
            requiredQty: 10.0,
            availableQty: 2.0,   // short by 8, but negative stock allowed (RC-2)
            allowNegative: true,
        );
        $availability = $this->makeAvailability(
            canManufacture: true,
            eligibility: ManufacturingEligibility::Partial,
            snapshot: $snapshot,
            rawMaterials: [$rawMaterial],
        );
        $decision = $this->makeDecision(DecisionType::Partial, reasonCode: 'mfg_partial_negative_stock');

        $plan = $this->planner->plan($availability, $decision);

        $this->assertTrue($plan->can_proceed);
        $this->assertTrue($plan->should_manufacture);
        $this->assertTrue($plan->hasNegativeStockRisk());
        $this->assertCount(1, $plan->negative_stock_decisions);

        $neg = $plan->negative_stock_decisions[0];
        $this->assertTrue($plan->components[0]->will_go_negative);
        $this->assertFalse($plan->components[0]->is_blocked);
        $this->assertSame(2.0, $neg->available_qty);
        $this->assertSame(10.0, $neg->qty_to_consume);
    }

    public function test_negative_stock_decision_projected_balance_is_correct(): void
    {
        $snapshot = $this->makeSnapshot();
        $rawMaterial = $this->makeRawMaterial(
            requiredQty: 15.0,
            availableQty: 3.0,  // will go to 3 - 15 = -12
            allowNegative: true,
        );
        $availability = $this->makeAvailability(
            eligibility: ManufacturingEligibility::Partial,
            snapshot: $snapshot,
            rawMaterials: [$rawMaterial],
        );

        $plan = $this->planner->plan($availability, $this->makeDecision(DecisionType::Partial));

        $this->assertSame(-12.0, $plan->negative_stock_decisions[0]->projected_balance);
    }

    public function test_no_negative_stock_decisions_when_all_materials_covered(): void
    {
        $snapshot = $this->makeSnapshot();
        $rawMaterial = $this->makeRawMaterial(requiredQty: 10.0, availableQty: 20.0);
        $availability = $this->makeAvailability(snapshot: $snapshot, rawMaterials: [$rawMaterial]);

        $plan = $this->plan($availability);

        $this->assertSame([], $plan->negative_stock_decisions);
        $this->assertFalse($plan->hasNegativeStockRisk());
    }

    // ── 8. Snapshot Integrity ────────────────────────────────────────────────

    public function test_recipe_snapshot_hash_is_64_char_sha256_hex(): void
    {
        $snapshot = $this->makeSnapshot(components: [$this->makeComponent()]);
        $availability = $this->makeAvailability(
            snapshot: $snapshot,
            rawMaterials: [$this->makeRawMaterial()],
        );

        $plan = $this->plan($availability);

        $this->assertNotNull($plan->recipe_snapshot_hash);
        $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $plan->recipe_snapshot_hash);
    }

    public function test_same_snapshot_always_produces_same_hash(): void
    {
        $snapshot = $this->makeSnapshot(productId: 'fixed-id', sku: 'FIXED-SKU', version: 3);
        $rawMaterial = $this->makeRawMaterial();
        $availability = $this->makeAvailability(snapshot: $snapshot, rawMaterials: [$rawMaterial]);

        $planA = $this->planner->plan($availability, $this->makeDecision());
        $planB = $this->planner->plan($availability, $this->makeDecision());

        $this->assertSame($planA->recipe_snapshot_hash, $planB->recipe_snapshot_hash);
    }

    public function test_different_snapshots_produce_different_hashes(): void
    {
        $snapshotA = $this->makeSnapshot(productId: 'prod-A', sku: 'SKU-A', version: 1);
        $snapshotB = $this->makeSnapshot(productId: 'prod-B', sku: 'SKU-B', version: 2);
        $rawMaterial = $this->makeRawMaterial();
        $availabilityA = $this->makeAvailability(productId: 'prod-A', snapshot: $snapshotA, rawMaterials: [$rawMaterial]);
        $availabilityB = $this->makeAvailability(productId: 'prod-B', snapshot: $snapshotB, rawMaterials: [$rawMaterial]);

        $planA = $this->planner->plan($availabilityA, $this->makeDecision());
        $planB = $this->planner->plan($availabilityB, $this->makeDecision());

        $this->assertNotSame($planA->recipe_snapshot_hash, $planB->recipe_snapshot_hash);
    }

    public function test_snapshot_hash_null_for_sufficient(): void
    {
        $availability = $this->makeAvailability(
            qtyToManufacture: 0.0,
            needsManufacturing: false,
            eligibility: ManufacturingEligibility::Sufficient,
        );

        $plan = $this->plan($availability);

        $this->assertNull($plan->recipe_snapshot_hash);
    }

    public function test_snapshot_hash_null_for_no_recipe(): void
    {
        $availability = $this->makeAvailability(
            canManufacture: false,
            eligibility: ManufacturingEligibility::NoRecipe,
        );

        $plan = $this->planner->plan($availability, $this->makeDecision(DecisionType::Reject));

        $this->assertNull($plan->recipe_snapshot_hash);
    }

    // ── 9. Plan Identity ─────────────────────────────────────────────────────

    public function test_plan_id_is_valid_uuid_v4(): void
    {
        $availability = $this->makeAvailability(
            eligibility: ManufacturingEligibility::Sufficient,
            qtyToManufacture: 0.0,
            needsManufacturing: false,
        );

        $plan = $this->plan($availability);

        $this->assertMatchesRegularExpression(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/',
            $plan->plan_id,
        );
    }

    public function test_each_plan_has_unique_plan_id(): void
    {
        $availability = $this->makeAvailability(
            eligibility: ManufacturingEligibility::Sufficient,
            qtyToManufacture: 0.0,
            needsManufacturing: false,
        );

        $planA = $this->plan($availability);
        $planB = $this->plan($availability);

        $this->assertNotSame($planA->plan_id, $planB->plan_id);
    }

    public function test_planned_at_is_iso_8601(): void
    {
        $availability = $this->makeAvailability(
            eligibility: ManufacturingEligibility::Sufficient,
            qtyToManufacture: 0.0,
            needsManufacturing: false,
        );

        $plan = $this->plan($availability);

        $this->assertNotFalse(
            DateTimeImmutable::createFromFormat(DateTimeInterface::ATOM, $plan->planned_at),
            "planned_at is not a valid ISO 8601 date: {$plan->planned_at}",
        );
    }

    // ── 10. Metadata Integrity ───────────────────────────────────────────────

    public function test_decision_type_and_reason_forwarded_to_plan(): void
    {
        $snapshot = $this->makeSnapshot();
        $availability = $this->makeAvailability(
            snapshot: $snapshot,
            rawMaterials: [$this->makeRawMaterial()],
        );
        $decision = $this->makeDecision(
            DecisionType::Approve,
            reasonCode: 'full_stock_available',
        );

        $plan = $this->planner->plan($availability, $decision);

        $this->assertSame(DecisionType::Approve, $plan->decision_type);
        $this->assertSame('full_stock_available', $plan->decision_reason->code);
    }

    public function test_trigger_info_present_in_metadata(): void
    {
        $snapshot = $this->makeSnapshot();
        $availability = $this->makeAvailability(
            snapshot: $snapshot,
            rawMaterials: [$this->makeRawMaterial()],
        );
        $decision = $this->makeDecision(
            triggerType: 'order_line',
            triggerId: 'line-abc',
            triggerVersion: 2,
            actorId: 'user-xyz',
        );

        $plan = $this->planner->plan($availability, $decision);

        $this->assertSame('order_line', $plan->metadata['trigger_type']);
        $this->assertSame('line-abc', $plan->metadata['trigger_id']);
        $this->assertSame(2, $plan->metadata['trigger_version']);
        $this->assertSame('user-xyz', $plan->metadata['actor_id']);
    }

    public function test_caller_metadata_merged_into_plan_metadata(): void
    {
        $availability = $this->makeAvailability(
            eligibility: ManufacturingEligibility::Sufficient,
            qtyToManufacture: 0.0,
            needsManufacturing: false,
        );

        $plan = $this->planner->plan(
            $availability,
            $this->makeDecision(),
            ['source' => 'api', 'request_id' => 'req-999'],
        );

        $this->assertSame('api', $plan->metadata['source']);
        $this->assertSame('req-999', $plan->metadata['request_id']);
    }

    public function test_warehouse_id_in_metadata(): void
    {
        $availability = $this->makeAvailability(
            eligibility: ManufacturingEligibility::Sufficient,
            qtyToManufacture: 0.0,
            needsManufacturing: false,
        );

        $plan = $this->plan($availability);

        $this->assertSame('wh-001', $plan->metadata['warehouse_id']);
    }

    // ── 11. toArray Structure ────────────────────────────────────────────────

    public function test_to_array_has_all_expected_keys(): void
    {
        $snapshot = $this->makeSnapshot();
        $availability = $this->makeAvailability(
            snapshot: $snapshot,
            rawMaterials: [$this->makeRawMaterial()],
        );

        $array = $this->plan($availability)->toArray();

        foreach ([
            'plan_id', 'product_id', 'warehouse_id', 'product_sku', 'product_name',
            'qty_to_manufacture', 'finished_goods_to_produce', 'available_finished_goods',
            'recipe_id', 'bom_version_number', 'recipe_snapshot_hash',
            'components', 'negative_stock_decisions',
            'eligibility', 'can_proceed', 'should_manufacture',
            'decision_type', 'decision_reason', 'planned_at', 'metadata',
        ] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing key: {$key}");
        }
    }

    // ── 12. Invariant Violation ───────────────────────────────────────────────

    public function test_planner_exception_when_can_manufacture_but_no_snapshot(): void
    {
        // Caller built an AvailabilityResult that says CanManufacture but forgot the snapshot
        $availability = $this->makeAvailability(
            eligibility: ManufacturingEligibility::CanManufacture,
            snapshot: null,  // invariant violation
        );

        $this->expectException(PlannerException::class);
        $this->expectExceptionMessage("eligibility='can_manufacture'");

        $this->plan($availability);
    }

    public function test_planner_exception_when_partial_but_no_snapshot(): void
    {
        $availability = $this->makeAvailability(
            eligibility: ManufacturingEligibility::Partial,
            snapshot: null,  // invariant violation
        );

        $this->expectException(PlannerException::class);

        $this->plan($availability);
    }

    public function test_planner_exception_has_correct_reason_code(): void
    {
        $availability = $this->makeAvailability(
            eligibility: ManufacturingEligibility::CanManufacture,
            snapshot: null,
        );

        try {
            $this->plan($availability);
            $this->fail('Expected PlannerException was not thrown');
        } catch (PlannerException $e) {
            $this->assertSame(PlannerException::RECIPE_SNAPSHOT_MISSING, $e->reason());
        }
    }
}
