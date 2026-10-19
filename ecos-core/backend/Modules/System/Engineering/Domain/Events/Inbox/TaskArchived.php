<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Events\Inbox;

final class TaskArchived
{
    public function __construct(
        public readonly string $taskId,
        public readonly string $companyId,
        public readonly string $archivedById,
    ) {}
}
