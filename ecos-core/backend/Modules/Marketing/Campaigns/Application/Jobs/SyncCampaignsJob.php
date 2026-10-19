<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Application\Jobs;

use DateTime;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Modules\Marketing\Campaigns\Application\Actions\SyncCampaignsAction;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;
use Modules\Marketing\Synchronization\Domain\Enums\SyncType;

/**
 * Queue-backed campaign structure sync.
 * Dispatched by CampaignSyncController when the caller requests async execution.
 * Insights sync is excluded — that belongs to TASK-META-INTEGRATION-004.
 */
final class SyncCampaignsJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    public int $timeout = 600; // 10 min — large accounts can have thousands of ads

    public array $backoff = [60, 120, 300]; // 1 min → 2 min → 5 min

    public function __construct(
        public readonly string $connectionId,
        public readonly string $syncType = 'full',
        public readonly bool $includeCreatives = true,
        public readonly ?string $actorId = null,
    ) {}

    public function handle(SyncCampaignsAction $action): void
    {
        $connection = MarketingConnection::findOrFail($this->connectionId);

        $type = SyncType::tryFrom($this->syncType) ?? SyncType::Full;

        $action->execute(
            connection: $connection,
            syncInsights: false,
            syncCreatives: $this->includeCreatives,
            insightDatePreset: 'last_30d',
            actorId: $this->actorId,
            syncType: $type,
        );
    }

    public function retryUntil(): DateTime
    {
        return now()->addHours(2);
    }

    public function tags(): array
    {
        return ["connection:{$this->connectionId}", "sync_type:{$this->syncType}"];
    }
}
