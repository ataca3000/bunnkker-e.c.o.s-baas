<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\DTOs;

use Modules\Operations\Preparation\Domain\Enums\PreparationIssueType;

final class ReportIssueDTO
{
    public function __construct(
        public readonly string $waveId,
        public readonly string $companyId,
        public readonly string $actorId,
        public readonly PreparationIssueType $issueType,
        public readonly string $description,
        public readonly ?string $entityType = null,
        public readonly ?string $entityId = null,
    ) {}
}
