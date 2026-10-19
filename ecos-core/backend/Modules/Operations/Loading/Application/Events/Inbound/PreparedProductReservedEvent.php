<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Application\Events\Inbound;

final class PreparedProductReservedEvent
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $poolEntryId,
        public readonly string $loadingSessionId,
        public readonly float $quantityReserved,
        public readonly string $actorId,
        public readonly string $occurredAt,
    ) {}
}
