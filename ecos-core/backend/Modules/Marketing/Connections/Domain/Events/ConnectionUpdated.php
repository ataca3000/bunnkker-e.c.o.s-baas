<?php

declare(strict_types=1);

namespace Modules\Marketing\Connections\Domain\Events;

use Modules\Marketing\Connections\Domain\Models\MarketingConnection;

final class ConnectionUpdated
{
    /** @param array<string, mixed> $changes */
    public function __construct(
        public readonly MarketingConnection $connection,
        public readonly array $changes,
        public readonly string $actorId,
    ) {}
}
