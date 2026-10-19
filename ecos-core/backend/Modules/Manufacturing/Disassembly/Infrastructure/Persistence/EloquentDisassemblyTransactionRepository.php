<?php

declare(strict_types=1);

namespace Modules\Manufacturing\Disassembly\Infrastructure\Persistence;

use Modules\Manufacturing\Disassembly\Domain\Contracts\DisassemblyTransactionRepositoryInterface;
use Modules\Manufacturing\Disassembly\Domain\Models\DisassemblyTransaction;

final class EloquentDisassemblyTransactionRepository implements DisassemblyTransactionRepositoryInterface
{
    public function findByPlanId(string $planId): ?DisassemblyTransaction
    {
        return DisassemblyTransaction::query()
            ->where('plan_id', $planId)
            ->first();
    }

    public function findByTriggerId(string $triggerId): ?DisassemblyTransaction
    {
        // Only match non-failed transactions — failed ones are retryable
        return DisassemblyTransaction::query()
            ->where('trigger_id', $triggerId)
            ->where('status', '!=', 'failed')
            ->first();
    }

    public function save(DisassemblyTransaction $transaction): void
    {
        $transaction->save();
    }
}
