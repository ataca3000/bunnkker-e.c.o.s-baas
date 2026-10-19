<?php

declare(strict_types=1);

namespace Modules\Marketing\Synchronization\Infrastructure\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;
use Modules\Marketing\Synchronization\Application\Actions\RunSyncAction;
use Modules\Marketing\Synchronization\Domain\Enums\SyncType;

final class SyncMarketingAssetsJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    public int $timeout = 120;

    public array $backoff = [30, 90];

    public function __construct(
        private readonly MarketingConnection $connection,
        private readonly SyncType $syncType = SyncType::Scheduled,
        private readonly ?string $triggeredBy = null,
    ) {}

    public function handle(RunSyncAction $action): void
    {
        $action->execute($this->connection, $this->syncType, $this->triggeredBy);
    }
}
