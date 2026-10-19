<?php

declare(strict_types=1);

namespace Modules\Commerce\Synchronization\Application\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Commerce\Synchronization\Application\Services\SyncLogService;
use Modules\Commerce\Synchronization\Application\Services\WooCommerceCustomerSyncer;
use Modules\Commerce\Synchronization\Domain\Enums\SyncDirection;
use Modules\Commerce\Synchronization\Domain\Enums\SyncEntityType;
use Modules\Commerce\Synchronization\Domain\Enums\SyncStatus;
use Throwable;

final class ProcessCustomerWebhookJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 30;

    /** @param array<string, mixed> $payload */
    public function __construct(
        private readonly Channel $channel,
        private readonly array $payload,
        private readonly string $topic,
    ) {}

    public function handle(SyncLogService $logService, WooCommerceCustomerSyncer $syncer): void
    {
        $externalId = (string) ($this->payload['id'] ?? '');

        $log = $logService->createLog(
            $this->channel,
            SyncEntityType::Customer,
            SyncDirection::Inbound,
            $this->topic,
            $externalId,
            SyncStatus::Processing,
            $this->payload,
        );

        try {
            $result = $syncer->sync($this->payload);

            $logService->markSuccess($log, $result, $this->channel);
        } catch (Throwable $e) {
            $logService->markFailed($log, $e->getMessage(), null, $this->channel);
            throw $e;
        }
    }
}
