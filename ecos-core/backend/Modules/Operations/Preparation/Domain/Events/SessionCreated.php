<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Events;

use Modules\Operations\Preparation\Domain\Models\PreparationSession;

final class SessionCreated
{
    public function __construct(
        public readonly PreparationSession $session,
        public readonly string $actorId,
    ) {}
}
