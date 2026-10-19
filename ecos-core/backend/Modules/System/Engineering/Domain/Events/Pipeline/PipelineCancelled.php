<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Events\Pipeline;

final class PipelineCancelled
{
    public function __construct(
        public readonly string  $pipelineId,
        public readonly string  $taskName,
        public readonly string  $branch,
        public readonly ?string $cancelledStage,
        public readonly string  $cancelledBy,
    ) {}
}
