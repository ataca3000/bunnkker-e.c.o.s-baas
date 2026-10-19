<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Events\Agent;

final class AgentHeartbeatReceived
{
    public function __construct(
        public readonly string $agentId,
        public readonly string $status,
        public readonly float $cpuPercent,
        public readonly int $memoryMbUsed,
        public readonly ?string $currentTaskId,
    ) {}
}
