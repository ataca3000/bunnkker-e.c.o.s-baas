<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingExecution\Application\Services;

use DateTimeImmutable;
use DateTimeInterface;
use Illuminate\Support\Facades\DB;
use Modules\Manufacturing\ManufacturingExecution\Domain\Contracts\InventoryMutationInterface;
use Modules\Manufacturing\ManufacturingExecution\Domain\Contracts\ManufacturingExecutorHooksInterface;
use Modules\Manufacturing\ManufacturingExecution\Domain\Contracts\ManufacturingTransactionRepositoryInterface;
use Modules\Manufacturing\ManufacturingExecution\Domain\Enums\TransactionStatus;
use Modules\Manufacturing\ManufacturingExecution\Domain\Exceptions\ExecutionException;
use Modules\Manufacturing\ManufacturingExecution\Domain\Models\ManufacturingTransaction;
use Modules\Manufacturing\ManufacturingExecution\Domain\ValueObjects\ManufacturingExecutionContext;
use Modules\Manufacturing\ManufacturingExecution\Domain\ValueObjects\ManufacturingExecutionResult;
use Throwable;

/**
 * PKG-05B — The only component that executes a validated ManufacturingExecutionContext.
 *
 * EXECUTE ONLY: Does not resolve recipes, check availability, build plans,
 * evaluate rules, make decisions, or validate the plan. All of that has
 * already been done by the Workflow (PKG-04C) and the Pipeline (PKG-05A).
 *
 * Execution guarantees:
 *   - Trust:          context.isValid() is checked; all other validation is deferred to Pipeline
 *   - Idempotent:     plan_id UNIQUE on manufacturing_transactions prevents double execution
 *   - Transactional:  all inventory + ledger + FIFO layer + transaction record commit together
 *   - Rollback:       any failure inside DB::transaction() reverts every DB change
 *   - Extensible:     lifecycle hooks fire at each stage; no internals modified for integrations
 *
 * Architecture:
 *   ManufacturingExecutionContext → ManufacturingExecutor → ManufacturingExecutionResult
 *
 * @param  string  $companyId  Company context for InventoryItem lazy-creation.
 *                             Must match the company owning the warehouse in the context.
 */
final class ManufacturingExecutor
{
    public function __construct(
        private readonly InventoryMutationInterface $inventory,
        private readonly ManufacturingTransactionRepositoryInterface $transactions,
        private readonly ?ManufacturingExecutorHooksInterface $hooks = null,
    ) {}

    /**
     * Execute a validated ManufacturingExecutionContext.
     *
     * @throws ExecutionException When context is invalid (no DB writes occur).
     * @throws Throwable On in-transaction failures (all DB changes rolled back).
     */
    public function execute(ManufacturingExecutionContext $context, string $companyId): ManufacturingExecutionResult
    {
        // ── Guard: context must be fully valid ────────────────────────────────
        if (! $context->isValid()) {
            throw ExecutionException::invalidContext(
                $context->plan->plan_id,
                count($context->validation_result->failures),
            );
        }

        // ── Lifecycle: before any DB writes ──────────────────────────────────
        $this->hooks?->onBeforeExecution($context);

        // ── Idempotency check (read-only) ─────────────────────────────────────
        $existing = $this->transactions->findByPlanId($context->plan->plan_id);
        if ($existing !== null) {
            return $this->buildIdempotentResult($existing, $context->execution_uuid);
        }

        // ── Execute inside a single database transaction ───────────────────────
        $startMs = (int) (microtime(true) * 1000);

        try {
            /** @var ManufacturingExecutionResult $result */
            $result = DB::transaction(function () use ($context, $companyId, $startMs): ManufacturingExecutionResult {
                $ledgerIds = [];

                // Step 1 — Consume all raw material components
                $consumptionRecords = [];
                foreach ($context->plan->components as $component) {
                    $record = $this->inventory->consumeComponent(
                        component: $component,
                        warehouseId: $context->plan->warehouse_id,
                        planId: $context->plan->plan_id,
                        companyId: $companyId,
                        executionUuid: $context->execution_uuid,
                    );
                    $consumptionRecords[] = $record;
                    $ledgerIds[] = $record->ledger_entry_id;
                }

                // Lifecycle hook: after all components consumed (still inside transaction)
                $this->hooks?->onAfterInventoryConsumption($context, $consumptionRecords, $ledgerIds);

                // Step 2 — Derive FG unit cost from consumed component FIFO costs.
                //   totalFifoCost = Σ(component.fifo_cost) across all consumed components.
                //   unitCost      = totalFifoCost / qty_to_manufacture (BCMath for precision).
                //   When all RMs had no FIFO layers (e.g. all went negative), unitCost = 0.0.
                $totalFifoCost = array_reduce(
                    $consumptionRecords,
                    fn (string $carry, $r): string => bcadd($carry, (string) $r->fifo_cost, 4),
                    '0',
                );
                $unitCost = $context->plan->qty_to_manufacture > 0
                    ? (float) bcdiv($totalFifoCost, (string) $context->plan->qty_to_manufacture, 4)
                    : 0.0;

                // Step 3 — Produce finished goods (creates on_hand_qty increment + FIFO receipt layer)
                $fgLedgerEntryId = $this->inventory->produceFinishedGoods(
                    productId: $context->plan->product_id,
                    qty: $context->plan->qty_to_manufacture,
                    warehouseId: $context->plan->warehouse_id,
                    planId: $context->plan->plan_id,
                    companyId: $companyId,
                    executionUuid: $context->execution_uuid,
                    unitCost: $unitCost,
                );
                $ledgerIds[] = $fgLedgerEntryId;

                // Lifecycle hook: after finished goods created (still inside transaction)
                $this->hooks?->onAfterFinishedGoodsCreated($context, $fgLedgerEntryId);

                // Step 4 — Record the manufacturing transaction (source of truth)
                $executedAt = (new DateTimeImmutable)->format(DateTimeInterface::ATOM);
                $durationMs = (int) (microtime(true) * 1000) - $startMs;

                $transaction = new ManufacturingTransaction;
                $transaction->fill([
                    'execution_id' => $context->execution_uuid,
                    'decision_key' => $context->decision_key,
                    'correlation_id' => $context->correlation_id,
                    'plan_id' => $context->plan->plan_id,
                    'product_id' => $context->plan->product_id,
                    'warehouse_id' => $context->plan->warehouse_id,
                    'bom_id' => $context->plan->recipe_id,
                    'bom_version_number' => $context->plan->bom_version_number,
                    'recipe_snapshot_hash' => $context->snapshot_hash,
                    'qty_produced' => $context->plan->qty_to_manufacture,
                    'status' => TransactionStatus::Completed->value,
                    'executed_at' => $executedAt,
                    'duration_ms' => $durationMs,
                    'order_line_id' => $context->plan->metadata['order_line_id'] ?? null, // RC-10
                    'metadata' => array_merge($context->transaction_metadata, [
                        'plan_id' => $context->plan->plan_id,
                        'correlation_id' => $context->correlation_id,
                    ]),
                ]);

                $this->transactions->save($transaction);

                return new ManufacturingExecutionResult(
                    execution_id: $context->execution_uuid,
                    transaction_id: $transaction->id,
                    success: true,
                    was_idempotent: false,
                    qty_produced: $context->plan->qty_to_manufacture,
                    consumed_components: $consumptionRecords,
                    ledger_entry_ids: $ledgerIds,
                    duration_ms: $durationMs,
                    executed_at: $executedAt,
                    metadata: $context->transaction_metadata,
                );
            });

            // Lifecycle hook: after successful commit (outside transaction)
            $this->hooks?->onAfterCommit($result);

            return $result;

        } catch (Throwable $e) {
            // Lifecycle hook: after rollback — DO NOT re-throw here
            $this->hooks?->onAfterRollback($context, $e);
            throw $e;
        }
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    /**
     * Build an idempotent result from an existing transaction record.
     *
     * Returns empty consumed_components and ledger_entry_ids — the original
     * execution data lives in the ledger and the transaction record.
     * A fresh execution_uuid is generated per call to allow log correlation
     * of the replay request itself.
     */
    private function buildIdempotentResult(
        ManufacturingTransaction $transaction,
        string $replayExecutionUuid,
    ): ManufacturingExecutionResult {
        return new ManufacturingExecutionResult(
            execution_id: $replayExecutionUuid,
            transaction_id: $transaction->id,
            success: $transaction->status === TransactionStatus::Completed,
            was_idempotent: true,
            qty_produced: (float) $transaction->qty_produced,
            consumed_components: [],
            ledger_entry_ids: [],
            duration_ms: 0,
            executed_at: (string) $transaction->executed_at,
            metadata: $transaction->metadata ?? [],
        );
    }
}
