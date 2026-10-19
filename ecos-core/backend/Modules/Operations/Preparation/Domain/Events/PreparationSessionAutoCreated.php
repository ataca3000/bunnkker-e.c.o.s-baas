<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class PreparationSessionAutoCreated
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly string $sessionId,
        public readonly string $warehouseId,
        public readonly string $companyId,
        public readonly string $businessDate,
        public readonly ?string $policyId,
        public readonly string $occurredAt,
    ) {}
}
