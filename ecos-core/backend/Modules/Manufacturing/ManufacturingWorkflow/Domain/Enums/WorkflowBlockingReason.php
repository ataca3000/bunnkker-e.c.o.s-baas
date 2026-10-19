<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingWorkflow\Domain\Enums;

use Modules\Manufacturing\AvailabilityEngine\Domain\Enums\ManufacturingEligibility;
use Modules\Manufacturing\DecisionKernel\Domain\Enums\DecisionType;

/**
 * Reason a ManufacturingWorkflow result is blocked.
 *
 * Only set when ManufacturingWorkflowResult.is_blocked = true.
 */
enum WorkflowBlockingReason: string
{
    // ── Decision stage ────────────────────────────────────────────────────────

    /** Decision Kernel returned Reject. */
    case DecisionRejected = 'decision_rejected';

    /** Decision Kernel returned Defer — re-evaluate later. */
    case DecisionDeferred = 'decision_deferred';

    /** Decision Kernel returned Escalate — needs human review. */
    case DecisionEscalated = 'decision_escalated';

    /** No rule matched the manufacturing context. */
    case NoMatchingRule = 'no_matching_rule';

    /** RecipeResolver could not resolve an active recipe for the product. */
    case RecipeNotFound = 'recipe_not_found';

    // ── Availability stage ────────────────────────────────────────────────────

    /** Inventory is insufficient and allow_negative_stock is false on at least one component. */
    case CannotManufacture = 'cannot_manufacture';

    /** Availability engine found no active recipe (deactivated between decision and availability stages). */
    case NoRecipe = 'no_recipe';

    // ── Planner stage ─────────────────────────────────────────────────────────

    /** Existing finished-goods stock is sufficient — no manufacturing run needed. */
    case ManufacturingNotNeeded = 'manufacturing_not_needed';

    // ── Helpers ───────────────────────────────────────────────────────────────

    public static function fromDecisionType(DecisionType $type): self
    {
        return match ($type) {
            DecisionType::Reject => self::DecisionRejected,
            DecisionType::Defer => self::DecisionDeferred,
            DecisionType::Escalate => self::DecisionEscalated,
            default => self::DecisionRejected,
        };
    }

    public static function fromEligibility(ManufacturingEligibility $eligibility): self
    {
        return match ($eligibility) {
            ManufacturingEligibility::NoRecipe => self::NoRecipe,
            ManufacturingEligibility::CannotManufacture => self::CannotManufacture,
            default => self::CannotManufacture,
        };
    }
}
