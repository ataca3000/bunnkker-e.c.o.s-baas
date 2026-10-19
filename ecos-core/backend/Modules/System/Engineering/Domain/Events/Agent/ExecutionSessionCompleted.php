<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Events\Agent;

final class ExecutionSessionCompleted
{
    public function __construct(
        public readonly string $sessionId,
        public readonly string $taskId,
        public readonly string $agentId,
        public readonly string $companyId,
        public readonly int $durationSeconds,
    ) {}
}
