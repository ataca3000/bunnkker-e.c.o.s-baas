<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Events\Pipeline;

final class StageCompleted
{
    public function __construct(
        public readonly string $pipelineId,
        public readonly string $stage,
        public readonly string $stageLabel,
        public readonly bool   $skipped,
        public readonly int    $durationSeconds,
        public readonly int    $retryCount,
    ) {}
}
