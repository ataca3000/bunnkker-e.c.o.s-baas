<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingWorkflow\Domain\Enums;

/**
 * The stage the ManufacturingWorkflow reached before returning its result.
 *
 * Stages advance sequentially — a blocked result always carries the stage at
 * which the workflow stopped, so callers know exactly which engine blocked.
 */
enum WorkflowStage: string
{
    /** Decision Orchestrator evaluated the request. */
    case DecisionEvaluated = 'decision_evaluated';

    /** Inventory Availability Engine analysed supply. */
    case AvailabilityAnalysed = 'availability_analysed';

    /**
     * Manufacturing Planner produced a plan.
     * The plan may or may not require execution (see ManufacturingPlan.should_manufacture).
     */
    case PlanProduced = 'plan_produced';
}
