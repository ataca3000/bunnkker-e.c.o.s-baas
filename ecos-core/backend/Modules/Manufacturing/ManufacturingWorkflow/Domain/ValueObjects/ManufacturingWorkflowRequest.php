<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingWorkflow\Domain\ValueObjects;

use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionTrigger;

/**
 * Input to the ManufacturingWorkflow.
 *
 * Captures everything the workflow needs to coordinate all engines:
 *   - What to manufacture and how much (product + quantity)
 *   - Where to manufacture it (warehouse)
 *   - Who or what triggered this request (trigger for Decision Kernel)
 *   - Caller-provided metadata (passed through to the plan)
 */
final readonly class ManufacturingWorkflowRequest
{
    public function __construct(
        /** UUID of the finished-good product to manufacture. */
        public string $product_id,

        /** UUID of the target warehouse for both input consumption and FG production. */
        public string $warehouse_id,

        /** UUID of the owning company — required for company-scoped inventory reads (F-INV-H2). */
        public string $company_id,

        /** Gross quantity of the finished good requested (before RC-1 partial adjustment). */
        public float $required_qty,

        /**
         * Trigger identity for the Decision Kernel.
         * Carries trigger_type, trigger_id, trigger_version (RC-6), triggered_at, actor_id.
         */
        public DecisionTrigger $trigger,

        /**
         * Arbitrary caller metadata passed through the entire workflow.
         * Included in the plan metadata and the workflow result.
         */
        public array $metadata = [],
    ) {}
}
