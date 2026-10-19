<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingExecution\Domain\Contracts;

use Modules\Manufacturing\ManufacturingExecution\Domain\ValueObjects\ComponentConsumptionRecord;
use Modules\Manufacturing\ManufacturingExecution\Domain\ValueObjects\ManufacturingExecutionContext;
use Modules\Manufacturing\ManufacturingExecution\Domain\ValueObjects\ManufacturingExecutionResult;
use Throwable;

/**
 * Lifecycle extension points for the ManufacturingExecutor.
 *
 * Implementations plug into execution stages without modifying the Executor.
 * No Laravel events are dispatched — these hooks fire synchronously inside
 * (or immediately after) the execution flow.
 *
 * Planned integrations (not implemented yet):
 *   - Procurement Queue    : onAfterInventoryConsumption (detect went_negative components)
 *   - Cost Engine          : onAfterCommit (recalculate product costs)
 *   - Decision Log         : onBeforeExecution / onAfterCommit
 *   - Notifications        : onAfterCommit / onAfterRollback
 *   - AI Analytics         : onAfterCommit
 *   - Audit Trail          : all hooks
 *
 * Hooks MUST NOT:
 *   - Open new database transactions (they are called inside or after one)
 *   - Throw exceptions from onAfterRollback (exception is re-thrown by executor)
 *   - Perform long-running I/O synchronously
 *
 * Inject via ManufacturingExecutionServiceProvider. Null = no hooks.
 */
interface ManufacturingExecutorHooksInterface
{
    /**
     * Called immediately before any DB writes.
     * Context is guaranteed valid at this point (isValid() = true).
     */
    public function onBeforeExecution(ManufacturingExecutionContext $context): void;

    /**
     * Called inside the DB transaction after all raw material components
     * have been consumed from inventory and FIFO layers updated.
     *
     * @param  list<ComponentConsumptionRecord>  $consumptionRecords
     * @param  list<string>  $ledgerIds
     */
    public function onAfterInventoryConsumption(
        ManufacturingExecutionContext $context,
        array $consumptionRecords,
        array $ledgerIds,
    ): void;

    /**
     * Called inside the DB transaction after finished goods have been
     * produced into inventory and the ProductionOutput ledger entry created.
     */
    public function onAfterFinishedGoodsCreated(
        ManufacturingExecutionContext $context,
        string $fgLedgerEntryId,
    ): void;

    /**
     * Called after the DB transaction commits successfully.
     * Safe to dispatch events, enqueue jobs, or call external services here.
     */
    public function onAfterCommit(ManufacturingExecutionResult $result): void;

    /**
     * Called when any exception escapes the execution flow (pre-guard or transaction failure).
     * Do NOT re-throw — the executor re-throws the original exception after this hook.
     */
    public function onAfterRollback(ManufacturingExecutionContext $context, Throwable $exception): void;
}
