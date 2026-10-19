<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Events;

use DateTimeImmutable;
use Illuminate\Foundation\Events\Dispatchable;

final class DemandAnalysisStarted
{
    use Dispatchable;

    public function __construct(
        public readonly string $operationalDay,
        public readonly string $correlationId,
        public readonly DateTimeImmutable $startedAt,
    ) {}
}
