<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Events;

final class LoadingSessionCreated
{
    public string $eventType = 'loading.session.created';

    public string $version = '1.0';

    public function __construct(
        public readonly string $companyId,
        public readonly string $sessionId,
        public readonly string $sessionNumber,
        public readonly string $warehouseId,
        public readonly string $operationalDate,
        public readonly string $sessionType,
        public readonly string $actorId,
        public readonly string $occurredAt,
    ) {}
}
