<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Domain\Events;

final class MetricsUpdated
{
    public function __construct(
        public readonly string $campaignId,
        public readonly string $level,
        public readonly string $dateStart,
        public readonly string $dateStop,
        public readonly int $rowsInserted,
    ) {}
}
