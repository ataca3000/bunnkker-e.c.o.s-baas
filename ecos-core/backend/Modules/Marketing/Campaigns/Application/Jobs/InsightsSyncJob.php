<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Application\Jobs;

use DateTime;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Modules\Marketing\Campaigns\Application\Services\CampaignInsightSyncService;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;

/**
 * Queue-backed insights sync job.
 *
 * Dispatched by the insights sync endpoint for async execution.
 * Handles rolling refresh (default) and full historical backfill.
 *
 * Uses 3 retries with 60s delay to survive transient Meta API rate-limit bursts.
 */
final class InsightsSyncJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    public int $timeout = 1800; // 30 min — large accounts need time

    public function __construct(
        public readonly string $connectionId,
        public readonly string $datePreset = 'last_30d',
        public readonly ?string $dateStart = null,
        public readonly ?string $dateStop = null,
        public readonly bool $forceRefresh = false,
        public readonly bool $includeAdLevel = false,
        public readonly ?string $actorId = null,
    ) {}

    public function handle(CampaignInsightSyncService $service): void
    {
        $connection = MarketingConnection::findOrFail($this->connectionId);

        $service->syncForConnection(
            connection: $connection,
            datePreset: $this->datePreset,
            dateStart: $this->dateStart,
            dateStop: $this->dateStop,
            forceRefresh: $this->forceRefresh,
            includeAdLevel: $this->includeAdLevel,
            actorId: $this->actorId,
        );
    }

    public function retryUntil(): DateTime
    {
        return now()->addHours(4);
    }

    public function tags(): array
    {
        return ["connection:{$this->connectionId}", "insights_sync:{$this->datePreset}"];
    }
}
