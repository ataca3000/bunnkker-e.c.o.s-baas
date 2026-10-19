<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Events;

use DateTimeImmutable;
use Illuminate\Foundation\Events\Dispatchable;

final class DemandAnalysisCompleted
{
    use Dispatchable;

    public function __construct(
        public readonly string $operationalDay,
        public readonly string $correlationId,
        public readonly int $productCount,
        public readonly int $totalOrders,
        public readonly DateTimeImmutable $completedAt,
    ) {}
}
