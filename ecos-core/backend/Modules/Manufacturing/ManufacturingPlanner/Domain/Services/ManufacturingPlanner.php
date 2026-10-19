<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingPlanner\Domain\Services;

use DateTimeImmutable;
use DateTimeInterface;
use JsonException;
use Modules\Manufacturing\AvailabilityEngine\Domain\Enums\ManufacturingEligibility;
use Modules\Manufacturing\AvailabilityEngine\Domain\ValueObjects\AvailabilityResult;
use Modules\Manufacturing\AvailabilityEngine\Domain\ValueObjects\RawMaterialAvailability;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionResult;
use Modules\Manufacturing\ManufacturingPlanner\Domain\Exceptions\PlannerException;
use Modules\Manufacturing\ManufacturingPlanner\Domain\ValueObjects\ComponentConsumptionPlan;
use Modules\Manufacturing\ManufacturingPlanner\Domain\ValueObjects\ManufacturingPlan;
use Modules\Manufacturing\ManufacturingPlanner\Domain\ValueObjects\NegativeStockDecision;

/**
 * Converts analysis (AvailabilityResult + DecisionResult) into an execution plan.
 *
 * PLAN ONLY: produces an immutable ManufacturingPlan. No inventory consumed,
 * no jobs dispatched, no records written, no costs calculated.
 *
 * The Manufacturing Engine (PKG-05) receives the plan and executes it.
 *
 * Input:  AvailabilityResult + DecisionResult + optional caller metadata
 * Output: ManufacturingPlan (immutable)
 *
 * Invariant: AvailabilityResult.recipe_snapshot must NOT be null when eligibility is
 * CanManufacture or Partial. Violation → PlannerException (programming error in caller).
 *
 * Valid non-manufacturing plans (NoRecipe, Sufficient, CannotManufacture, Deferred, etc.)
 * are returned as plans with can_proceed = false or should_manufacture = false — never thrown.
 */
final class ManufacturingPlanner
{
    /**
     * @throws PlannerException When AvailabilityResult carries manufacturing eligibility
     *                          (CanManufacture|Partial) but recipe_snapshot is null.
     */
    public function plan(
        AvailabilityResult $availability,
        DecisionResult $decision,
        array $metadata = [],
    ): ManufacturingPlan {
        $this->assertInvariant($availability);

        $plannedAt = (new DateTimeImmutable)->format(DateTimeInterface::ATOM);
        $snapshot = $availability->recipe_snapshot;

        // Build per-component plans from the availability analysis
        $components = $this->buildComponents($availability);
        $negativeStockDecisions = $this->buildNegativeStockDecisions($components);

        // can_proceed: both eligibility and the Decision Kernel must be positive
        $canProceed = $availability->eligibility->allowsManufacturing()
            && $decision->decision->isPositive();
        $shouldManufacture = $canProceed && $availability->needs_manufacturing;

        // Merge caller metadata with plan-level context
        $fullMetadata = array_merge([
            'warehouse_id' => $availability->warehouse_id,
            'decided_at' => $decision->decided_at,
            'trigger_type' => $decision->trigger->trigger_type,
            'trigger_id' => $decision->trigger->trigger_id,
            'trigger_version' => $decision->trigger->trigger_version,
            'actor_id' => $decision->trigger->actor_id,
        ], $metadata);

        return new ManufacturingPlan(
            plan_id: $this->generatePlanId(),
            product_id: $availability->product_id,
            warehouse_id: $availability->warehouse_id,
            product_sku: $snapshot?->product_sku,
            product_name: $snapshot?->product_name,
            qty_to_manufacture: $availability->qty_to_manufacture,
            finished_goods_to_produce: $availability->qty_to_manufacture,
            available_finished_goods: $availability->available_finished_goods,
            recipe_id: $snapshot?->recipe_id,
            bom_version_number: $snapshot?->bom_version_number,
            recipe_snapshot: $snapshot,
            recipe_snapshot_hash: $this->hashSnapshot($availability),
            components: $components,
            negative_stock_decisions: $negativeStockDecisions,
            eligibility: $availability->eligibility,
            can_proceed: $canProceed,
            should_manufacture: $shouldManufacture,
            decision_type: $decision->decision,
            decision_reason: $decision->reason,
            planned_at: $plannedAt,
            metadata: $fullMetadata,
        );
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Guards against the one invariant that would indicate a programming error:
     * manufacturing eligibility present but no snapshot to back it up.
     *
     * @throws PlannerException
     */
    private function assertInvariant(AvailabilityResult $availability): void
    {
        $needsSnapshot = $availability->eligibility === ManufacturingEligibility::CanManufacture
            || $availability->eligibility === ManufacturingEligibility::Partial;

        if ($needsSnapshot && $availability->recipe_snapshot === null) {
            throw PlannerException::recipeSnapshotMissing($availability->eligibility->value);
        }
    }

    /** @return list<ComponentConsumptionPlan> */
    private function buildComponents(AvailabilityResult $availability): array
    {
        return array_map(
            fn (RawMaterialAvailability $mat): ComponentConsumptionPlan => new ComponentConsumptionPlan(
                component_id: $mat->component_id,
                sku: $mat->sku,
                name: $mat->name,
                unit_symbol: $mat->unit_symbol,
                qty_to_consume: $mat->required_qty,
                available_qty: $mat->available_qty,
                missing_qty: $mat->missing_qty,
                allow_negative_stock: $mat->allow_negative_stock,
                will_go_negative: $mat->missing_qty > 0.0 && $mat->allow_negative_stock,
                is_blocked: $mat->missing_qty > 0.0 && ! $mat->allow_negative_stock,
            ),
            $availability->raw_materials,
        );
    }

    /**
     * @param  list<ComponentConsumptionPlan>  $components
     * @return list<NegativeStockDecision>
     */
    private function buildNegativeStockDecisions(array $components): array
    {
        $decisions = [];

        foreach ($components as $plan) {
            if ($plan->will_go_negative) {
                $decisions[] = new NegativeStockDecision(
                    component_id: $plan->component_id,
                    sku: $plan->sku,
                    name: $plan->name,
                    unit_symbol: $plan->unit_symbol,
                    available_qty: $plan->available_qty,
                    qty_to_consume: $plan->qty_to_consume,
                    projected_balance: $plan->available_qty - $plan->qty_to_consume,
                );
            }
        }

        return $decisions;
    }

    /**
     * SHA-256 of the RecipeSnapshot JSON — lets the Manufacturing Engine detect
     * any recipe mutation between planning and execution.
     * Returns null when there is no recipe (Sufficient / NoRecipe cases).
     */
    private function hashSnapshot(AvailabilityResult $availability): ?string
    {
        $snapshot = $availability->recipe_snapshot;

        if ($snapshot === null) {
            return null;
        }

        try {
            return hash('sha256', json_encode($snapshot->toArray(), JSON_THROW_ON_ERROR));
        } catch (JsonException) {
            // toArray() returns only scalar / array data — this path is unreachable
            return null;
        }
    }

    /** Generates a UUID v4 without framework dependencies. */
    private function generatePlanId(): string
    {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0F | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3F | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
