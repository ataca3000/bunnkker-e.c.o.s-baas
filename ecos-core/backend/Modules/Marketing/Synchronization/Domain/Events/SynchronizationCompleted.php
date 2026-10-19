<?php

declare(strict_types=1);

namespace Modules\Marketing\Synchronization\Domain\Events;

use Modules\Marketing\Synchronization\Domain\Models\MarketingSyncLog;

final class SynchronizationCompleted
{
    public function __construct(
        public readonly MarketingSyncLog $syncLog,
        public readonly int $assetsDiscovered,
        public readonly int $assetsCreated,
        public readonly int $assetsUpdated,
        public readonly int $assetsFailed,
    ) {}
}
