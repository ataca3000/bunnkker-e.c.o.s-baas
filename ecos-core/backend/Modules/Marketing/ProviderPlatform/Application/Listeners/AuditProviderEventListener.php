<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Application\Listeners;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Modules\Admin\Configuration\Domain\Services\ConfigAuditService;
use Modules\Marketing\ProviderPlatform\Domain\Events\AbstractProviderEvent;

/**
 * Persists every provider domain event to the Config Audit OS.
 *
 * Runs on the 'audit' queue — never blocks the originating request.
 * The payload written to the audit log mirrors the event's toArray() output,
 * which by contract contains no sensitive credentials.
 */
final class AuditProviderEventListener implements ShouldQueue
{
    use InteractsWithQueue;

    public string $queue = 'audit';

    public int $tries = 3;

    public int $timeout = 15;

    public function __construct(
        private readonly ConfigAuditService $audit,
    ) {}

    public function handle(AbstractProviderEvent $event): void
    {
        $this->audit->record(
            companyId: $event->companyId,
            module: 'marketing',
            category: 'provider_lifecycle',
            action: $event->eventName(),
            oldValue: $event->previousStatus ? ['status' => $event->previousStatus] : null,
            newValue: [
                'provider' => $event->provider,
                'provider_type' => $event->providerType,
                'current_status' => $event->currentStatus,
                'metadata' => $event->metadata,
            ],
            configKey: "provider.{$event->provider}.lifecycle",
            reason: "Domain event: {$event->eventName()} [{$event->eventId}]",
        );
    }
}
