<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingService\Application\DTOs\Requests;

/**
 * Input DTO for ManufacturingApplicationService::simulateManufacturing().
 *
 * Identical context to a real manufacture request but no execution occurs.
 * The workflow runs and the plan is produced; no inventory is touched.
 * Used for pre-flight checks, capacity planning, and UI previews.
 */
final readonly class SimulateManufacturingRequest
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
