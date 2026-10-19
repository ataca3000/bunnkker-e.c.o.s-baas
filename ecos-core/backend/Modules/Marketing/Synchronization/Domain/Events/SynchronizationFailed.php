<?php

declare(strict_types=1);

namespace Modules\Marketing\Synchronization\Domain\Events;

use Modules\Marketing\Synchronization\Domain\Models\MarketingSyncLog;

final class SynchronizationFailed
{
    public function __construct(
        public readonly MarketingSyncLog $syncLog,
        public readonly string $errorMessage,
    ) {}
}
