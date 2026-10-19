<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * An operational exception was closed — by a person or because the condition
 * cleared on its own.
 *
 * Notification only. The `status` distinguishes a human resolution from an
 * auto-resolution, so a consumer can tell "someone dealt with it" from "it went
 * away", without recomputing anything.
 */
class OperationalExceptionResolved
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly string $exceptionUuid,
        public readonly string $source,
        public readonly string $status,
        public readonly ?string $resolution,
        public readonly ?string $companyId,
        public readonly string $occurredAt,
    ) {}
}
