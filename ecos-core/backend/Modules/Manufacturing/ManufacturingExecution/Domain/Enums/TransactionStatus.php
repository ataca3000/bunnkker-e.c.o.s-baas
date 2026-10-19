<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingExecution\Domain\Enums;

enum TransactionStatus: string
{
    case Completed = 'completed';
    case Failed = 'failed';
    case RolledBack = 'rolled_back';

    public function isTerminal(): bool
    {
        return true; // all statuses are terminal — no in-flight status stored
    }
}
