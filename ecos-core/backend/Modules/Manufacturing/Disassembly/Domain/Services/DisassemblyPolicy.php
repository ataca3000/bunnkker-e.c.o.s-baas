<?php

declare(strict_types=1);

namespace Modules\Manufacturing\Disassembly\Domain\Services;

use Modules\Manufacturing\Disassembly\Domain\Enums\DisassemblyPolicyCode;
use Modules\Manufacturing\Disassembly\Domain\ValueObjects\DisassemblyPolicyRequest;
use Modules\Manufacturing\Disassembly\Domain\ValueObjects\DisassemblyPolicyResult;

/**
 * Disassembly Policy — pure domain eligibility evaluator.
 *
 * Evaluates 5 rules in priority order and short-circuits at the first failure.
 * Performs zero DB queries. The caller resolves all flags before calling evaluate().
 *
 * Rule evaluation order:
 *   1. Product can disassemble (can_disassemble = true)
 *   2. Recipe exists            (has_active_recipe = true)
 *   3. Product is inventory-managed
 *   4. Quantity > 0
 *   5. Not already disassembled (idempotency — trigger-level guard)
 *
 * CONTRACT — this service MUST NOT:
 *   - Call ManufacturingApplicationService
 *   - Consume inventory
 *   - Write any DB record
 *   - Dispatch jobs or events
 */
final class DisassemblyPolicy
{
    public function evaluate(DisassemblyPolicyRequest $request): DisassemblyPolicyResult
    {
        $ctx = array_merge($request->metadata, [
            'product_id' => $request->product_id,
            'trigger_id' => $request->trigger_id,
        ]);

        // ── Rule 1: Product can disassemble ───────────────────────────────────
        if (! $request->can_disassemble) {
            return DisassemblyPolicyResult::ineligible(
                code: DisassemblyPolicyCode::ProductCannotDisassemble,
                reason: 'Product is not flagged as disassemblable (can_disassemble = false).',
                metadata: $ctx,
            );
        }

        // ── Rule 2: Recipe exists ──────────────────────────────────────────────
        if (! $request->has_active_recipe) {
            return DisassemblyPolicyResult::ineligible(
                code: DisassemblyPolicyCode::RecipeNotFound,
                reason: 'No active recipe (Bill of Materials) exists for this product.',
                metadata: $ctx,
            );
        }

        // ── Rule 3: Product is inventory-managed ───────────────────────────────
        if (! $request->is_inventory_managed) {
            return DisassemblyPolicyResult::ineligible(
                code: DisassemblyPolicyCode::ProductNotInventoryManaged,
                reason: 'Product is not tracked by the inventory system.',
                metadata: $ctx,
            );
        }

        // ── Rule 4: Quantity > 0 ───────────────────────────────────────────────
        if ($request->quantity <= 0.0) {
            return DisassemblyPolicyResult::ineligible(
                code: DisassemblyPolicyCode::DisassemblyNotRequired,
                reason: 'Quantity is zero or negative. No disassembly needed.',
                metadata: array_merge($ctx, ['quantity' => $request->quantity]),
            );
        }

        // ── Rule 5: Not already disassembled ──────────────────────────────────
        if ($request->already_disassembled) {
            return DisassemblyPolicyResult::ineligible(
                code: DisassemblyPolicyCode::AlreadyDisassembled,
                reason: 'A disassembly transaction already exists for this trigger.',
                metadata: $ctx,
            );
        }

        // ── All rules passed ───────────────────────────────────────────────────
        return DisassemblyPolicyResult::eligible(
            metadata: array_merge($ctx, ['quantity' => $request->quantity]),
        );
    }
}
