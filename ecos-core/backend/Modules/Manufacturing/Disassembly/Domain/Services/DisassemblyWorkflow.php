<?php

declare(strict_types=1);

namespace Modules\Manufacturing\Disassembly\Domain\Services;

use Illuminate\Support\Str;
use Modules\Manufacturing\AvailabilityEngine\Domain\Contracts\InventoryReadInterface;
use Modules\Manufacturing\BillsOfMaterials\Domain\Contracts\RecipeResolverInterface;
use Modules\Manufacturing\BillsOfMaterials\Domain\Exceptions\RecipeResolverException;
use Modules\Manufacturing\BillsOfMaterials\Domain\ValueObjects\RecipeComponent;
use Modules\Manufacturing\Disassembly\Domain\ValueObjects\ComponentProductionPlan;
use Modules\Manufacturing\Disassembly\Domain\ValueObjects\DisassemblyPlan;
use Modules\Manufacturing\Disassembly\Domain\ValueObjects\DisassemblyWorkflowResult;
use Modules\Manufacturing\ManufacturingService\Application\DTOs\Requests\DisassembleProductRequest;

/**
 * Disassembly Workflow — orchestrates recipe resolution, FG availability check, and plan building.
 *
 * Three stages:
 *   1. Recipe Resolution  — resolve the active recipe for the product
 *   2. FG Availability    — confirm sufficient finished goods exist at the warehouse
 *   3. Plan Building      — produce an immutable DisassemblyPlan
 *
 * No DB writes occur here. All inventory mutations happen in DisassemblyExecutor.
 *
 * CONTRACT — this service MUST NOT:
 *   - Consume inventory
 *   - Create ledger entries
 *   - Write database records
 *   - Dispatch jobs or events
 */
final class DisassemblyWorkflow
{
    public function __construct(
        private readonly RecipeResolverInterface $resolver,
        private readonly InventoryReadInterface $inventoryReader,
    ) {}

    public function run(DisassembleProductRequest $request): DisassemblyWorkflowResult
    {
        // ── Stage 1: Resolve active recipe ────────────────────────────────────
        try {
            $snapshot = $this->resolver->resolve($request->product_id);
        } catch (RecipeResolverException $e) {
            return DisassemblyWorkflowResult::blocked(
                reason: 'recipe_not_found',
                metadata: array_merge($request->metadata, [
                    'product_id' => $request->product_id,
                    'resolver_error' => $e->getMessage(),
                ]),
            );
        }

        // ── Stage 2: Check finished goods availability ────────────────────────
        // Use on_hand - reserved (same as manufacturing availability checks)
        $available = $this->inventoryReader->availableQty($request->warehouse_id, $request->product_id, $request->company_id);

        if ($available < $request->quantity) {
            return DisassemblyWorkflowResult::blocked(
                reason: 'insufficient_finished_goods',
                metadata: array_merge($request->metadata, [
                    'product_id' => $request->product_id,
                    'qty_requested' => $request->quantity,
                    'qty_available' => $available,
                    'qty_short' => $request->quantity - $available,
                ]),
            );
        }

        // ── Stage 3: Build immutable plan ─────────────────────────────────────
        $componentOutputs = array_map(
            fn (RecipeComponent $c): ComponentProductionPlan => new ComponentProductionPlan(
                component_id: $c->component_id,
                sku: $c->sku,
                name: $c->name,
                unit_symbol: $c->unit_symbol,
                qty_to_produce: round($c->quantity * $request->quantity, 4),
                required_per_unit: $c->quantity,
            ),
            $snapshot->components,
        );

        $plan = new DisassemblyPlan(
            plan_id: Str::uuid()->toString(),
            product_id: $request->product_id,
            warehouse_id: $request->warehouse_id,
            qty_to_disassemble: $request->quantity,
            recipe_snapshot: $snapshot,
            component_outputs: $componentOutputs,
            trigger_id: $request->trigger_id,
            metadata: $request->metadata,
        );

        return DisassemblyWorkflowResult::ready($plan, $request->metadata);
    }
}
