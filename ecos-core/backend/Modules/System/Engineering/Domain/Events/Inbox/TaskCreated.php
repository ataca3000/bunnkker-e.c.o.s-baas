<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Events\Inbox;

final class TaskCreated
{
    public function __construct(
        public readonly string $taskId,
        public readonly string $companyId,
        public readonly string $title,
        public readonly string $status,
        public readonly int $priority,
        public readonly string $createdById,
    ) {}
}
