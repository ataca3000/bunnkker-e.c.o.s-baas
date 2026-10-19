<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Events\Pipeline;

final class PipelineCompleted
{
    public function __construct(
        public readonly string $pipelineId,
        public readonly string $taskName,
        public readonly string $branch,
        public readonly int    $durationSeconds,
        public readonly ?string $commitSha,
    ) {}
}
