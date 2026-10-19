<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Events\Pipeline;

final class StageFailed
{
    public function __construct(
        public readonly string  $pipelineId,
        public readonly string  $stage,
        public readonly string  $stageLabel,
        public readonly ?string $errorMessage,
        public readonly int     $retryCount,
        public readonly int     $durationSeconds,
    ) {}
}
