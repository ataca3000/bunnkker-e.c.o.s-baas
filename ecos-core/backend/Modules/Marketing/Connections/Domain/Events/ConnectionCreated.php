<?php

declare(strict_types=1);

namespace Modules\Marketing\Connections\Domain\Events;

use Modules\Marketing\Connections\Domain\Models\MarketingConnection;

final class ConnectionCreated
{
    public function __construct(
        public readonly MarketingConnection $connection,
        public readonly string $actorId,
    ) {}
}
