<?php

declare(strict_types=1);

namespace Modules\Manufacturing\Disassembly\Domain\ValueObjects;

/**
 * Input for DisassemblyPolicy::evaluate().
 *
 * The caller is responsible for resolving the boolean flags from the product/context
 * before calling the policy. The policy is pure and performs no DB queries.
 */
final readonly class DisassemblyPolicyRequest
{
    /**
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        public string $product_id,
        public float $quantity,
        public string $actor_id,
        public bool $can_disassemble,
        public bool $has_active_recipe,
        public bool $is_inventory_managed,
        public bool $already_disassembled,
        public ?string $trigger_id = null,
        public string $trigger_type = 'manual',
        public array $metadata = [],
    ) {}
}
