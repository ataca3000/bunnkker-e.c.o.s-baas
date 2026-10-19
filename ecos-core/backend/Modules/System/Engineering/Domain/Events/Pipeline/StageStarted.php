<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Events\Pipeline;

final class StageStarted
{
    public function __construct(
        public readonly string $pipelineId,
        public readonly string $stage,
        public readonly string $stageLabel,
        public readonly int    $retryCount,
    ) {}
}
