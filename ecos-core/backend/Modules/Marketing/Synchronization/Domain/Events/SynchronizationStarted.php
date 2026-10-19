<?php

declare(strict_types=1);

namespace Modules\Marketing\Synchronization\Domain\Events;

use Modules\Marketing\Synchronization\Domain\Models\MarketingSyncLog;

final class SynchronizationStarted
{
    public function __construct(
        public readonly MarketingSyncLog $syncLog,
        public readonly string $connectionId,
        public readonly string $syncType,
        public readonly ?string $triggeredBy,
    ) {}
}
