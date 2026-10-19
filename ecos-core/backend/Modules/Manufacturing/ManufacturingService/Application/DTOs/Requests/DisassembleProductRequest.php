<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingService\Application\DTOs\Requests;

/**
 * Input DTO for ManufacturingApplicationService::disassembleProduct().
 *
 * company_id  — Required for inventory mutations (InventoryItem lazy-creation).
 * trigger_id  — Business idempotency anchor (e.g. return_line_id). When provided,
 *               the executor checks for an existing successful disassembly for this
 *               trigger and returns an idempotent result without re-executing.
 */
final readonly class DisassembleProductRequest
{
    /**
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        public string $product_id,
        public string $warehouse_id,
        public string $company_id,
        public float $quantity,
        public string $actor_id,
        public ?string $trigger_id = null,
        public string $trigger_type = 'manual',
        public array $metadata = [],
    ) {}
}
