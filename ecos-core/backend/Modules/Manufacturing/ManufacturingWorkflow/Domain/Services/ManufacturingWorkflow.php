<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingWorkflow\Domain\Services;

use DateTimeImmutable;
use DateTimeInterface;
use Modules\Manufacturing\AvailabilityEngine\Domain\Services\InventoryAvailabilityEngine;
use Modules\Manufacturing\BillsOfMaterials\Domain\Exceptions\RecipeResolverException;
use Modules\Manufacturing\DecisionKernel\Domain\Exceptions\NoMatchingRuleException;
use Modules\Manufacturing\DecisionOrchestrator\Domain\Builders\ManufacturingContextBuilder;
use Modules\Manufacturing\DecisionOrchestrator\Domain\Services\DecisionOrchestrator;
use Modules\Manufacturing\ManufacturingPlanner\Domain\Services\ManufacturingPlanner;
use Modules\Manufacturing\ManufacturingWorkflow\Domain\Enums\WorkflowBlockingReason;
use Modules\Manufacturing\ManufacturingWorkflow\Domain\Enums\WorkflowStage;
use Modules\Manufacturing\ManufacturingWorkflow\Domain\ValueObjects\ManufacturingWorkflowRequest;
use Modules\Manufacturing\ManufacturingWorkflow\Domain\ValueObjects\ManufacturingWorkflowResult;

/**
 * PKG-04C: Manufacturing Workflow — the single entry point for every manufacturing request.
 *
 * Coordinates all manufacturing engines in a fixed, sequential order:
 *
 *   1. Decision Orchestrator  — evaluates rules; resolves the recipe
 *   2. Availability Engine    — analyses inventory supply against recipe components
 *   3. Manufacturing Planner  — converts analysis into an immutable ManufacturingPlan
 *
 * The workflow STOPS at the first engine that blocks execution and returns a typed
 * ManufacturingWorkflowResult explaining where and why it stopped.
 *
 * CONTRACT — this service MUST NOT:
 *   - Consume inventory
 *   - Create ledger entries
 *   - Write database records
 *   - Dispatch jobs
 *   - Update costs
 *   - Perform procurement
 *
 * The Execution Pipeline (PKG-05A) and Executor (PKG-05B) are the next stage —
 * they are NOT called here. The workflow stops after the plan is produced.
 */
final class ManufacturingWorkflow
{
    public function __construct(
        private readonly DecisionOrchestrator $orchestrator,
        private readonly InventoryAvailabilityEngine $availabilityEngine,
        private readonly ManufacturingPlanner $planner,
    ) {}

    /**
     * Run the full manufacturing workflow for the given request.
     *
     * Always returns a ManufacturingWorkflowResult — never throws for business outcomes.
     * Check result->isPlanReady() to determine if the plan is ready for execution.
     */
    public function run(ManufacturingWorkflowRequest $request): ManufacturingWorkflowResult
    {
        $workflowId = $this->generateUuid();
        $completedAt = fn (): string => (new DateTimeImmutable)->format(DateTimeInterface::ATOM);

        // ── Stage 1: Decision Orchestrator ────────────────────────────────────
        try {
            $orchestratorResult = $this->orchestrator->orchestrate(
                trigger: $request->trigger,
                builder: new ManufacturingContextBuilder,
                parameters: [
                    'product_id' => $request->product_id,
                    'ordered_qty' => $request->required_qty,
                    'available_qty' => 0.0,
                    'shortage_qty' => $request->required_qty,
                    'warehouse_id' => $request->warehouse_id,
                ],
                metadata: $request->metadata,
            );
        } catch (RecipeResolverException $e) {
            return new ManufacturingWorkflowResult(
                workflow_id: $workflowId,
                stage: WorkflowStage::DecisionEvaluated,
                is_blocked: true,
                blocking_reason: WorkflowBlockingReason::RecipeNotFound,
                decision_result: null,
                recipe_snapshot: null,
                availability_result: null,
                plan: null,
                metadata: array_merge($request->metadata, [
                    'recipe_resolver_error' => $e->getMessage(),
                    'recipe_resolver_code' => $e->getMessage(),
                ]),
                completed_at: $completedAt(),
            );
        } catch (NoMatchingRuleException $e) {
            return new ManufacturingWorkflowResult(
                workflow_id: $workflowId,
                stage: WorkflowStage::DecisionEvaluated,
                is_blocked: true,
                blocking_reason: WorkflowBlockingReason::NoMatchingRule,
                decision_result: null,
                recipe_snapshot: null,
                availability_result: null,
                plan: null,
                metadata: array_merge($request->metadata, [
                    'no_matching_rule_context' => $e->contextType(),
                ]),
                completed_at: $completedAt(),
            );
        }

        $decisionResult = $orchestratorResult->decision;

        // Block if the decision is not positive (Reject, Defer, Escalate)
        if (! $decisionResult->decision->isPositive()) {
            return new ManufacturingWorkflowResult(
                workflow_id: $workflowId,
                stage: WorkflowStage::DecisionEvaluated,
                is_blocked: true,
                blocking_reason: WorkflowBlockingReason::fromDecisionType($decisionResult->decision),
                decision_result: $decisionResult,
                recipe_snapshot: $orchestratorResult->recipe_snapshot,
                availability_result: null,
                plan: null,
                metadata: array_merge($request->metadata, $orchestratorResult->metadata),
                completed_at: $completedAt(),
            );
        }

        // ── Stage 2: Inventory Availability Engine ────────────────────────────
        $availabilityResult = $this->availabilityEngine->analyse(
            productId: $request->product_id,
            warehouseId: $request->warehouse_id,
            requiredQty: $request->required_qty,
            companyId: $request->company_id,
        );

        // Block if eligibility prevents manufacturing (CannotManufacture, NoRecipe)
        if (! $availabilityResult->eligibility->allowsManufacturing()) {
            return new ManufacturingWorkflowResult(
                workflow_id: $workflowId,
                stage: WorkflowStage::AvailabilityAnalysed,
                is_blocked: true,
                blocking_reason: WorkflowBlockingReason::fromEligibility($availabilityResult->eligibility),
                decision_result: $decisionResult,
                recipe_snapshot: $orchestratorResult->recipe_snapshot,
                availability_result: $availabilityResult,
                plan: null,
                metadata: array_merge($request->metadata, $orchestratorResult->metadata),
                completed_at: $completedAt(),
            );
        }

        // ── Stage 3: Manufacturing Planner ────────────────────────────────────
        $plan = $this->planner->plan(
            availability: $availabilityResult,
            decision: $decisionResult,
            metadata: array_merge($request->metadata, $orchestratorResult->metadata, [
                'workflow_id' => $workflowId,
            ]),
        );

        // Block when manufacturing is not actually needed (Sufficient stock)
        if (! $plan->should_manufacture) {
            return new ManufacturingWorkflowResult(
                workflow_id: $workflowId,
                stage: WorkflowStage::PlanProduced,
                is_blocked: true,
                blocking_reason: WorkflowBlockingReason::ManufacturingNotNeeded,
                decision_result: $decisionResult,
                recipe_snapshot: $orchestratorResult->recipe_snapshot,
                availability_result: $availabilityResult,
                plan: $plan,
                metadata: $plan->metadata,
                completed_at: $completedAt(),
            );
        }

        // ── Success: plan is ready for execution ──────────────────────────────
        return new ManufacturingWorkflowResult(
            workflow_id: $workflowId,
            stage: WorkflowStage::PlanProduced,
            is_blocked: false,
            blocking_reason: null,
            decision_result: $decisionResult,
            recipe_snapshot: $orchestratorResult->recipe_snapshot,
            availability_result: $availabilityResult,
            plan: $plan,
            metadata: $plan->metadata,
            completed_at: $completedAt(),
        );
    }

    private function generateUuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0F | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3F | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
