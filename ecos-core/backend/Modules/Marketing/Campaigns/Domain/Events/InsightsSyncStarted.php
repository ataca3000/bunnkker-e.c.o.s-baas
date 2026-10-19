<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Domain\Events;

use Modules\Marketing\Connections\Domain\Models\MarketingConnection;

final class InsightsSyncStarted
{
    public function __construct(
        public readonly MarketingConnection $connection,
        public readonly string $syncType,
        public readonly string $datePreset,
        public readonly ?string $dateStart,
        public readonly ?string $dateStop,
        public readonly ?string $actorId,
    ) {}
}
