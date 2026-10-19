<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingService\Application\Services;

use Illuminate\Support\Str;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionTrigger;
use Modules\Manufacturing\Disassembly\Application\Services\DisassemblyExecutor;
use Modules\Manufacturing\Disassembly\Domain\Services\DisassemblyWorkflow;
use Modules\Manufacturing\ManufacturingExecution\Application\Services\ManufacturingExecutor;
use Modules\Manufacturing\ManufacturingExecution\Domain\Services\ExecutionPipeline;
use Modules\Manufacturing\ManufacturingService\Application\DTOs\Requests\DisassembleProductRequest;
use Modules\Manufacturing\ManufacturingService\Application\DTOs\Requests\ManufactureProductRequest;
use Modules\Manufacturing\ManufacturingService\Application\DTOs\Requests\SimulateManufacturingRequest;
use Modules\Manufacturing\ManufacturingService\Application\DTOs\Requests\ValidateManufacturingRequest;
use Modules\Manufacturing\ManufacturingService\Application\DTOs\Responses\DisassembleProductResponse;
use Modules\Manufacturing\ManufacturingService\Application\DTOs\Responses\ManufactureProductResponse;
use Modules\Manufacturing\ManufacturingService\Application\DTOs\Responses\SimulateManufacturingResponse;
use Modules\Manufacturing\ManufacturingService\Application\DTOs\Responses\ValidateManufacturingResponse;
use Modules\Manufacturing\ManufacturingWorkflow\Domain\Services\ManufacturingWorkflow;
use Modules\Manufacturing\ManufacturingWorkflow\Domain\ValueObjects\ManufacturingWorkflowRequest;

/**
 * PKG-06A / PKG-08: Manufacturing Application Service.
 *
 * The single public entry point for the entire Manufacturing domain.
 *
 * CONTRACT — callers MUST:
 *   - Only use this class; never call Workflow, Pipeline, Executor,
 *     Availability Engine, Planner, or Decision Orchestrator directly.
 *
 * CONTRACT — this service MUST NOT:
 *   - Contain business rules (they live in the domain engines)
 *   - Integrate with Orders, POS, Scheduler, or API Controllers
 *   - Dispatch Laravel Events (reserved for PKG-06B)
 *
 * Methods:
 *   manufactureProduct()    — full path: workflow → pipeline → executor
 *   simulateManufacturing() — dry-run: workflow only; no mutations
 *   validateManufacturing() — workflow + pipeline; no mutations
 *   disassembleProduct()    — PKG-08: disassembly workflow → executor
 */
final class ManufacturingApplicationService
{
    public function __construct(
        private readonly ManufacturingWorkflow $workflow,
        private readonly ExecutionPipeline $pipeline,
        private readonly ManufacturingExecutor $executor,
        private readonly DisassemblyWorkflow $disassemblyWorkflow,
        private readonly DisassemblyExecutor $disassemblyExecutor,
    ) {}

    /**
     * Manufacture a product: run the full workflow, validate the plan,
     * and execute the inventory mutations inside a DB transaction.
     *
     * Returns a typed response for every outcome — blocked, executed, or
     * idempotent replay. Callers check is_blocked / was_executed / was_idempotent.
     */
    public function manufactureProduct(ManufactureProductRequest $request): ManufactureProductResponse
    {
        $workflowRequest = $this->buildWorkflowRequest(
            productId: $request->product_id,
            warehouseId: $request->warehouse_id,
            companyId: $request->company_id,
            requiredQty: $request->required_qty,
            actorId: $request->actor_id,
            triggerType: $request->trigger_type,
            triggerId: $request->trigger_id ?? $this->generateUuid(),
            metadata: $request->metadata,
        );

        $workflowResult = $this->workflow->run($workflowRequest);

        if (! $workflowResult->isPlanReady()) {
            return ManufactureProductResponse::blocked($workflowResult);
        }

        $context = $this->pipeline->prepare($workflowResult->plan);
        $executionResult = $this->executor->execute($context, $request->company_id);

        return ManufactureProductResponse::fromExecution($workflowResult, $executionResult);
    }

    /**
     * Simulate manufacturing without executing.
     *
     * Runs the full Manufacturing Workflow and returns the plan details —
     * components, quantities, negative-stock risks, decision type — without
     * touching any inventory. Safe to call repeatedly; zero side effects.
     */
    public function simulateManufacturing(SimulateManufacturingRequest $request): SimulateManufacturingResponse
    {
        $workflowRequest = $this->buildWorkflowRequest(
            productId: $request->product_id,
            warehouseId: $request->warehouse_id,
            companyId: $request->company_id,
            requiredQty: $request->required_qty,
            actorId: $request->actor_id,
            triggerType: $request->trigger_type,
            triggerId: $request->trigger_id ?? $this->generateUuid(),
            metadata: $request->metadata,
        );

        $workflowResult = $this->workflow->run($workflowRequest);

        return SimulateManufacturingResponse::fromWorkflow($workflowResult);
    }

    /**
     * Validate whether a manufacturing request can be executed.
     *
     * Runs both the Manufacturing Workflow and the Execution Pipeline.
     * Returns a two-layer validation report: workflow validity and plan
     * validity, including any typed pipeline failure codes.
     *
     * No inventory mutations occur. Use this for pre-flight checks before
     * calling manufactureProduct().
     */
    public function validateManufacturing(ValidateManufacturingRequest $request): ValidateManufacturingResponse
    {
        $workflowRequest = $this->buildWorkflowRequest(
            productId: $request->product_id,
            warehouseId: $request->warehouse_id,
            companyId: $request->company_id,
            requiredQty: $request->required_qty,
            actorId: $request->actor_id,
            triggerType: $request->trigger_type,
            triggerId: $request->trigger_id ?? $this->generateUuid(),
            metadata: $request->metadata,
        );

        $workflowResult = $this->workflow->run($workflowRequest);

        if (! $workflowResult->isPlanReady()) {
            return ValidateManufacturingResponse::blocked($workflowResult);
        }

        $context = $this->pipeline->prepare($workflowResult->plan);

        return ValidateManufacturingResponse::fromPipeline($workflowResult, $context);
    }

    /**
     * Disassemble a finished good back into its raw material components.
     *
     * Flow: DisassemblyWorkflow (recipe + availability) → DisassemblyExecutor (mutations).
     * Idempotent when trigger_id is provided — returns the original transaction on replay.
     * Callers SHOULD evaluate DisassemblyPolicy BEFORE calling this method.
     */
    public function disassembleProduct(DisassembleProductRequest $request): DisassembleProductResponse
    {
        $workflowResult = $this->disassemblyWorkflow->run($request);

        if (! $workflowResult->isPlanReady()) {
            return DisassembleProductResponse::blocked($workflowResult);
        }

        $executionResult = $this->disassemblyExecutor->execute(
            plan: $workflowResult->plan,
            companyId: $request->company_id,
        );

        return DisassembleProductResponse::fromExecution($workflowResult, $executionResult);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private function buildWorkflowRequest(
        string $productId,
        string $warehouseId,
        string $companyId,
        float $requiredQty,
        string $actorId,
        string $triggerType,
        string $triggerId,
        array $metadata,
    ): ManufacturingWorkflowRequest {
        return new ManufacturingWorkflowRequest(
            product_id: $productId,
            warehouse_id: $warehouseId,
            company_id: $companyId,
            required_qty: $requiredQty,
            trigger: DecisionTrigger::now(
                type: $triggerType,
                id: $triggerId,
                version: 1,
                actor: $actorId,
                metadata: $metadata,
            ),
            metadata: $metadata,
        );
    }

    private function generateUuid(): string
    {
        return Str::uuid()->toString();
    }
}
