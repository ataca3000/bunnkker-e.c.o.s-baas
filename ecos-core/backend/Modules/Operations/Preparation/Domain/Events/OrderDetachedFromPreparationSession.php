<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class OrderDetachedFromPreparationSession
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly string $sessionId,
        public readonly string $orderId,
        public readonly string $warehouseId,
        public readonly string $reason,
        public readonly ?string $detachedBy,
        public readonly string $occurredAt,
    ) {}
}
