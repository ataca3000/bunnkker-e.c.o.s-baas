<?php

declare(strict_types=1);

namespace Modules\Logistics\Automation\Application\Listeners;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Modules\Logistics\Automation\Domain\Services\AutomationEngine;
use Modules\Logistics\Automation\Domain\ValueObjects\AutomationEvent;

/**
 * The shared spine of every automation consumer.
 *
 * ┌─ BACKGROUND PROCESSING WITH A RETRY POLICY ─────────────────────────────┐
 * │ Consumers implement ShouldQueue, so in production they run on the queue  │
 * │ (workers), off the operational request path. `$tries` and `backoff()`    │
 * │ are the retry policy for transient queue-level failures. In the test     │
 * │ environment (sync queue) they run inline, which is why the engine is     │
 * │ exception-safe — a consumer can never break the dispatching operation.   │
 * │                                                                          │
 * │ NO BUSINESS LOGIC LIVES HERE. A listener only normalises its event and   │
 * │ hands it to the AutomationEngine, which logs and notifies. It calls no   │
 * │ operational service.                                                     │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
abstract class AbstractAutomationListener implements ShouldQueue
{
    use InteractsWithQueue;

    /** Retry policy — attempts before the job is considered failed. */
    public int $tries = 3;

    /** Stop after this many uncaught exceptions, independent of $tries. */
    public int $maxExceptions = 3;

    public function __construct(
        protected readonly AutomationEngine $engine,
    ) {}

    /** Retry backoff in seconds — progressively longer between attempts. */
    public function backoff(): array
    {
        return [10, 30, 60];
    }

    /** Run the normalised event through the engine. */
    protected function process(AutomationEvent $event): void
    {
        $this->engine->handle($event);
    }

    /** Map a severity string from a status, consistently across consumers. */
    protected function severityForStatus(?string $status): string
    {
        return match ($status) {
            'not_ready' => 'critical',
            'degraded' => 'warning',
            default => 'info',
        };
    }
}
