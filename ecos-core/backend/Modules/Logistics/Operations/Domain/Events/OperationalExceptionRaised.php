<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * A NEW operational exception was raised (not a repeat of a known one).
 *
 * Notification only. Fires once, when the registry creates a fresh row — a
 * deduplicated recurrence bumps a counter and does NOT raise this event, so a
 * consumer counting raises counts distinct problems, not occurrences.
 *
 * Carries the exception's identity and classification as immutable scalars; a
 * consumer that needs the full record looks it up by uuid, keeping this event
 * free of any database access of its own.
 */
class OperationalExceptionRaised
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly string $exceptionUuid,
        public readonly string $source,
        public readonly string $category,
        public readonly string $severity,
        public readonly string $exceptionType,
        public readonly ?string $companyId,
        public readonly string $occurredAt,
    ) {}
}
