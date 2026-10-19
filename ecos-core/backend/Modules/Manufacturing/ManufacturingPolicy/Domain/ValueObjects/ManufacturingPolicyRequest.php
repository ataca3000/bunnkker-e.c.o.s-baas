<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingPolicy\Domain\ValueObjects;

/**
 * The manufacturing intent that the policy must evaluate.
 *
 * Contains only the raw intent: what product, how much, who asked.
 * Order and product states are carried in OrderContext and ProductContext.
 *
 * required_qty is the gross quantity requested by the order line.
 * The policy checks that this is > 0 (ManufacturingNotRequired guard).
 * Actual shortage calculation (RC-1) is deferred to the Workflow.
 */
final readonly class ManufacturingPolicyRequest
{
    /**
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        /** UUID of the finished-good product to manufacture. */
        public string $product_id,

        /** Quantity the order line requires. */
        public float $required_qty,

        /** ID of the actor (user / system) requesting evaluation. */
        public string $actor_id,

        /** Optional caller metadata passed through to the result. */
        public array $metadata = [],
    ) {}
}
