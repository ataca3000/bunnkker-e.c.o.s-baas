<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Events;

final class LoadingSessionClosed
{
    public string $eventType = 'loading.session.closed';

    public string $version = '1.0';

    public function __construct(
        public readonly string $companyId,
        public readonly string $sessionId,
        public readonly string $sessionNumber,
        public readonly int $totalVehicles,
        public readonly string $actorId,
        public readonly string $occurredAt,
    ) {}
}
