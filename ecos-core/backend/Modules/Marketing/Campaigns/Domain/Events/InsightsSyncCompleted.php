<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Domain\Events;

use Modules\Marketing\Connections\Domain\Models\MarketingConnection;

final class InsightsSyncCompleted
{
    public function __construct(
        public readonly MarketingConnection $connection,
        public readonly int $rowsImported,
        public readonly int $rowsSkipped,
        public readonly int $errors,
        public readonly int $apiCalls,
        public readonly int $durationMs,
    ) {}
}
