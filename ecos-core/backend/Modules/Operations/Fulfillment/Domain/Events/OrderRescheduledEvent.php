<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class OrderRescheduledEvent
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly string $orderId,
        public readonly string $orderNumber,
        public readonly string $companyId,
        public readonly string $fromStatus,
        public readonly string $nextDeliveryDate,
        public readonly ?string $rescheduleReason,
        public readonly ?string $resumeFromStatus,
        public readonly string $rescheduledAt,
        public readonly ?string $actorId,
    ) {}
}
