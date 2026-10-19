<?php

declare(strict_types=1);

namespace Modules\Manufacturing\Disassembly\Application\Services;

use DateTimeImmutable;
use DateTimeInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Manufacturing\Disassembly\Domain\Contracts\DisassemblyTransactionRepositoryInterface;
use Modules\Manufacturing\Disassembly\Domain\Models\DisassemblyTransaction;
use Modules\Manufacturing\Disassembly\Domain\ValueObjects\ComponentProductionPlan;
use Modules\Manufacturing\Disassembly\Domain\ValueObjects\DisassemblyExecutionResult;
use Modules\Manufacturing\Disassembly\Domain\ValueObjects\DisassemblyPlan;
use Modules\Manufacturing\Disassembly\Infrastructure\Adapters\DisassemblyInventoryAdapter;
use Modules\Manufacturing\ManufacturingExecution\Domain\Enums\TransactionStatus;

/**
 * Disassembly Executor — the only component that executes a validated DisassemblyPlan.
 *
 * Execution guarantees:
 *   - Idempotent:     trigger_id + plan_id UNIQUE indexes prevent double-execution.
 *   - Transactional:  all inventory mutations + ledger entries + transaction record commit together.
 *   - Rollback:       any failure inside DB::transaction() reverts every DB change.
 *
 * Execution flow (all inside DB::transaction()):
 *   Step 1 — Consume finished goods (deduct on_hand_qty + DisassemblyConsumption ledger + FIFO layers)
 *   Step 2 — Produce each component  (add on_hand_qty + DisassemblyOutput ledger)
 *   Step 3 — Record DisassemblyTransaction
 *
 * CONTRACT — this executor MUST NOT:
 *   - Resolve recipes
 *   - Check FG availability (that is DisassemblyWorkflow's responsibility)
 *   - Open nested DB transactions
 */
final class DisassemblyExecutor
{
    public function __construct(
        private readonly DisassemblyInventoryAdapter $inventory,
        private readonly DisassemblyTransactionRepositoryInterface $transactions,
    ) {}

    public function execute(DisassemblyPlan $plan, string $companyId): DisassemblyExecutionResult
    {
        // ── Idempotency: trigger_id (business guard — return line) ────────────
        if ($plan->trigger_id !== null) {
            $existing = $this->transactions->findByTriggerId($plan->trigger_id);
            if ($existing !== null) {
                return $this->buildIdempotentResult($existing);
            }
        }

        // ── Idempotency: plan_id (technical guard — plan deduplication) ───────
        $existingByPlan = $this->transactions->findByPlanId($plan->plan_id);
        if ($existingByPlan !== null) {
            return $this->buildIdempotentResult($existingByPlan);
        }

        $startMs = (int) (microtime(true) * 1000);
        $executionUuid = Str::uuid()->toString();

        /** @var DisassemblyExecutionResult $result */
        $result = DB::transaction(
            function () use ($plan, $companyId, $startMs, $executionUuid): DisassemblyExecutionResult {
                $ledgerIds = [];

                // Step 1 — Consume finished goods
                $fgLedgerId = $this->inventory->consumeFinishedGoods(
                    productId: $plan->product_id,
                    qty: $plan->qty_to_disassemble,
                    warehouseId: $plan->warehouse_id,
                    planId: $plan->plan_id,
                    companyId: $companyId,
                    executionUuid: $executionUuid,
                );
                $ledgerIds[] = $fgLedgerId;

                // Step 2 — Produce each component
                $productionRecords = [];
                foreach ($plan->component_outputs as $output) {
                    /** @var ComponentProductionPlan $output */
                    $record = $this->inventory->produceComponent(
                        component: $output,
                        warehouseId: $plan->warehouse_id,
                        planId: $plan->plan_id,
                        companyId: $companyId,
                        executionUuid: $executionUuid,
                    );
                    $productionRecords[] = $record;
                    $ledgerIds[] = $record->ledger_entry_id;
                }

                // Step 3 — Record the disassembly transaction (source of truth)
                $executedAt = (new DateTimeImmutable)->format(DateTimeInterface::ATOM);
                $durationMs = (int) (microtime(true) * 1000) - $startMs;

                $transaction = new DisassemblyTransaction;
                $transaction->fill([
                    'execution_id' => $executionUuid,
                    'plan_id' => $plan->plan_id,
                    'trigger_id' => $plan->trigger_id,
                    'product_id' => $plan->product_id,
                    'warehouse_id' => $plan->warehouse_id,
                    'bom_id' => $plan->recipe_snapshot->recipe_id,
                    'bom_version_number' => $plan->recipe_snapshot->bom_version_number,
                    'recipe_snapshot_hash' => hash('sha256', json_encode($plan->recipe_snapshot->toArray())),
                    'qty_disassembled' => $plan->qty_to_disassemble,
                    'status' => TransactionStatus::Completed->value,
                    'executed_at' => $executedAt,
                    'duration_ms' => $durationMs,
                    'metadata' => $plan->metadata,
                ]);

                $this->transactions->save($transaction);

                return new DisassemblyExecutionResult(
                    execution_id: $executionUuid,
                    transaction_id: $transaction->id,
                    success: true,
                    was_idempotent: false,
                    qty_disassembled: $plan->qty_to_disassemble,
                    produced_components: $productionRecords,
                    ledger_entry_ids: $ledgerIds,
                    duration_ms: $durationMs,
                    executed_at: $executedAt,
                    metadata: $plan->metadata,
                );
            },
        );

        return $result;
    }

    private function buildIdempotentResult(DisassemblyTransaction $transaction): DisassemblyExecutionResult
    {
        return new DisassemblyExecutionResult(
            execution_id: Str::uuid()->toString(),
            transaction_id: $transaction->id,
            success: $transaction->status === TransactionStatus::Completed,
            was_idempotent: true,
            qty_disassembled: (float) $transaction->qty_disassembled,
            produced_components: [],
            ledger_entry_ids: [],
            duration_ms: 0,
            executed_at: (string) $transaction->executed_at,
            metadata: $transaction->metadata ?? [],
        );
    }
}
