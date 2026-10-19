<?php

declare(strict_types=1);

namespace Modules\Logistics\Automation\Infrastructure\Observability;

use Illuminate\Support\Facades\Log;
use Modules\Logistics\Automation\Domain\ValueObjects\AutomationEvent;

/**
 * Structured event logging — the observability backbone.
 *
 * Every consumed domain event is written as a structured log line. This is the
 * schema-free observability store: no table, no cache. A log shipper (ELK,
 * Loki, CloudWatch) consumes the stream downstream without any change here.
 */
class EventLogger
{
    private const CHANNEL_TAG = 'logistics.automation';

    public function event(AutomationEvent $event): void
    {
        Log::info(self::CHANNEL_TAG.'.event', [
            'event' => $event->name,
            'severity' => $event->severity,
            'status' => $event->status,
            'company_id' => $event->companyId,
            'occurred_at' => $event->occurredAt,
            'payload' => $event->payload,
        ]);
    }

    /** @param array<string, mixed> $context */
    public function failure(string $event, string $reason, array $context = []): void
    {
        // A consumer failure is itself an observability signal — recorded, and
        // deliberately NOT rethrown by the engine, so the operation is never
        // affected by an automation problem.
        Log::warning(self::CHANNEL_TAG.'.consumer_failed', [
            'event' => $event,
            'reason' => $reason,
        ] + $context);
    }
}
