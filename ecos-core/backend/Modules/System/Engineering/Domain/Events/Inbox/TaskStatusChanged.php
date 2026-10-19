<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Events\Inbox;

final class TaskStatusChanged
{
    public function __construct(
        public readonly string $taskId,
        public readonly string $companyId,
        public readonly string $fromStatus,
        public readonly string $toStatus,
        public readonly string $actorId,
        public readonly string $actorType,
        public readonly ?string $reason,
    ) {}
}
