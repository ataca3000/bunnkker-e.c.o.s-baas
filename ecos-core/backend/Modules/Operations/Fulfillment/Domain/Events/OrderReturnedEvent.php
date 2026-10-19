<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class OrderReturnedEvent
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly string $orderId,
        public readonly string $orderNumber,
        public readonly string $companyId,
        public readonly string $returnId,
        public readonly string $returnReason,
        public readonly string $returnedAt,
        public readonly ?string $actorId,
    ) {}
}
