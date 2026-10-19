<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingExecution\Domain\Contracts;

use Modules\Manufacturing\ManufacturingExecution\Domain\Models\ManufacturingTransaction;

interface ManufacturingTransactionRepositoryInterface
{
    /**
     * Find an existing transaction by plan_id (idempotency key).
     * Returns null if this plan has never been executed.
     */
    public function findByPlanId(string $planId): ?ManufacturingTransaction;

    /**
     * Persist a ManufacturingTransaction.
     * The UNIQUE(plan_id) constraint acts as a second-layer idempotency guard
     * against concurrent execution of the same plan.
     */
    public function save(ManufacturingTransaction $transaction): void;
}
