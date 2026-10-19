<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Events\Inbox;

final class TaskUpdated
{
    public function __construct(
        public readonly string $taskId,
        public readonly string $companyId,
        public readonly array $changes,
        public readonly string $updatedById,
    ) {}
}
