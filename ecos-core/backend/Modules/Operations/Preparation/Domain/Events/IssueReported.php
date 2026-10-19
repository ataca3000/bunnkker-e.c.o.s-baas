<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Events;

use Modules\Operations\Preparation\Domain\Models\PreparationException;

final class IssueReported
{
    public function __construct(
        public readonly PreparationException $exception,
        public readonly string $actorId,
    ) {}
}
