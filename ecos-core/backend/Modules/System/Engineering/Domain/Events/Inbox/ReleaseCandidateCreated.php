<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Events\Inbox;

final class ReleaseCandidateCreated
{
    public function __construct(
        public readonly string $releaseCandidateId,
        public readonly string $companyId,
        public readonly string $title,
        public readonly int $taskCount,
        public readonly string $createdById,
    ) {}
}
