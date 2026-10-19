<?php

declare(strict_types=1);

namespace Modules\Manufacturing\Disassembly\Domain\Contracts;

use Modules\Manufacturing\Disassembly\Domain\Models\DisassemblyTransaction;

interface DisassemblyTransactionRepositoryInterface
{
    public function findByPlanId(string $planId): ?DisassemblyTransaction;

    /** Returns null for failed transactions (they are retryable). */
    public function findByTriggerId(string $triggerId): ?DisassemblyTransaction;

    public function save(DisassemblyTransaction $transaction): void;
}
