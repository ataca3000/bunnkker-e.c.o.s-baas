<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingService\Application\DTOs\Requests;

/**
 * Input DTO for ManufacturingApplicationService::validateManufacturing().
 *
 * Runs the full Manufacturing Workflow and the Execution Pipeline validation
 * without executing. Returns a typed validation report: workflow validity,
 * plan validity, and any pipeline failure codes.
 *
 * Use this before triggering actual execution to confirm the plan is
 * execution-ready and identify blocking conditions early.
 */
final readonly class ValidateManufacturingRequest
{
    public function __construct(
        public string $product_id,
        public string $warehouse_id,
        public string $company_id,
        public float $required_qty,
        public string $actor_id,
        public string $trigger_type = 'manual',
        public ?string $trigger_id = null,
        public array $metadata = [],
    ) {}
}
