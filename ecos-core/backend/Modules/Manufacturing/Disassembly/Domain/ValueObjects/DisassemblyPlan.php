<?php

declare(strict_types=1);

namespace Modules\Manufacturing\Disassembly\Domain\ValueObjects;

use Modules\Manufacturing\BillsOfMaterials\Domain\ValueObjects\RecipeSnapshot;

/**
 * Immutable disassembly plan produced by DisassemblyWorkflow.
 *
 * Contains everything needed to execute disassembly without hitting the DB again.
 * Passed directly to DisassemblyExecutor::execute().
 */
final readonly class DisassemblyPlan
{
    /**
     * @param  list<ComponentProductionPlan>  $component_outputs
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        /** UUID — primary idempotency key on disassembly_transactions. */
        public string $plan_id,

        /** UUID of the finished good to be disassembled. */
        public string $product_id,

        public string $warehouse_id,

        /** Quantity of finished goods to consume. */
        public float $qty_to_disassemble,

        /** Locked recipe snapshot at workflow resolution time. */
        public RecipeSnapshot $recipe_snapshot,

        /** What components will be produced (inverse of recipe). */
        public array $component_outputs,

        /**
         * Business idempotency anchor (e.g. return_line_id).
         * When provided, enforced via UNIQUE partial index on disassembly_transactions.
         */
        public ?string $trigger_id = null,

        public array $metadata = [],
    ) {}
}
