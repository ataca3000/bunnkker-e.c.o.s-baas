<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Application\Listeners;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderHealthChanged;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderTokenExpired;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderValidationFailed;

/**
 * Notifies administrators when provider health degrades.
 *
 * Listens to health-critical events and routes notifications through the
 * Notification OS (wired below).  The Notification OS is not yet implemented,
 * so this listener logs the notification intent and prepares the payload.
 *
 * To wire the real Notification OS, replace the Log::warning() calls with:
 *   NotificationService::dispatch(new ProviderHealthNotification($companyId, $message, $severity));
 */
final class NotifyOnProviderHealthChangeListener implements ShouldQueue
{
    use InteractsWithQueue;

    public string $queue = 'notifications';

    public int $tries = 2;

    public int $timeout = 10;

    public function handleHealthChanged(ProviderHealthChanged $event): void
    {
        $degraded = in_array($event->currentStatus, [
            'invalid_configuration', 'service_unavailable', 'unknown',
        ], true);

        if (! $degraded) {
            return;
        }

        $this->notify(
            companyId: $event->companyId,
            severity: 'critical',
            title: "Provider {$event->provider} health degraded",
            message: "Status changed from {$event->previousStatus} to {$event->currentStatus}.",
            context: $event->toArray(),
        );
    }

    public function handleTokenExpired(ProviderTokenExpired $event): void
    {
        $this->notify(
            companyId: $event->companyId,
            severity: 'warning',
            title: "Provider {$event->provider} token expired",
            message: 'The OAuth access token has expired. Please reconnect to restore syncing.',
            context: $event->toArray(),
        );
    }

    public function handleValidationFailed(ProviderValidationFailed $event): void
    {
        $errors = $event->metadata['errors'] ?? [];

        $this->notify(
            companyId: $event->companyId,
            severity: 'warning',
            title: "Provider {$event->provider} credential validation failed",
            message: implode(' ', $errors),
            context: $event->toArray(),
        );
    }

    private function notify(
        string $companyId,
        string $severity,
        string $title,
        string $message,
        array $context,
    ): void {
        // TODO: replace with Notification OS dispatch when available.
        Log::channel('slack')->warning("[Provider Alert] [{$severity}] {$title}: {$message}", [
            'company_id' => $companyId,
            'context' => $context,
        ]);

        Log::warning("[ProviderPlatform] Notification: {$title}", [
            'severity' => $severity,
            'company_id' => $companyId,
            'message' => $message,
        ]);
    }
}
