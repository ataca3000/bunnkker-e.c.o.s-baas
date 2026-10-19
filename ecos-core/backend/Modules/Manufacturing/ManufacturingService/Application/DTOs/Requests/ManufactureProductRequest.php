<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingService\Application\DTOs\Requests;

/**
 * Input DTO for ManufacturingApplicationService::manufactureProduct().
 *
 * Carries all context needed to run the Manufacturing Workflow AND execute
 * the resulting plan in a single call.
 *
 * company_id is required because the Manufacturing Executor uses it to
 * find-or-create InventoryItem rows (lazy-initialization pattern).
 */
final readonly class ManufactureProductRequest
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
