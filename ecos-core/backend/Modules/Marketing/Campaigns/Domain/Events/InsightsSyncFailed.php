<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Domain\Events;

use Modules\Marketing\Connections\Domain\Models\MarketingConnection;

final class InsightsSyncFailed
{
    public function __construct(
        public readonly MarketingConnection $connection,
        public readonly string $errorMessage,
        public readonly int $apiCalls,
        public readonly int $durationMs,
    ) {}
}
