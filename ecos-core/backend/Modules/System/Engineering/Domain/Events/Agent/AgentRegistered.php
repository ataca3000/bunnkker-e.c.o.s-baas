<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Events\Agent;

final class AgentRegistered
{
    public function __construct(
        public readonly string $agentId,
        public readonly string $companyId,
        public readonly string $name,
        public readonly string $agentType,
    ) {}
}
