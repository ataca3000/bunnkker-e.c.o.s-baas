<?php

declare(strict_types=1);

namespace Modules\Platform\EventPlatform\Presentation\Console;

use Illuminate\Console\Command;
use Modules\Platform\EventPlatform\Application\Services\EnterpriseEventReplayService;
use Modules\Platform\EventPlatform\Domain\Contracts\EnterpriseDeadLetterQueueInterface;
use Throwable;

class DrainDlqCommand extends Command
{
    protected $signature = 'event-platform:drain-dlq
        {--company-id= : Process only entries for this company}
        {--discard : Mark entries as discarded instead of replaying}
        {--limit=50 : Maximum entries to process in one run}';

    protected $description = 'Drain the Enterprise Event Platform Dead Letter Queue';

    public function handle(
        EnterpriseDeadLetterQueueInterface $dlq,
        EnterpriseEventReplayService $replayService,
    ): int {
        $companyId = $this->option('company-id');
        $discard = $this->option('discard');
        $limit = (int) $this->option('limit');

        $entries = $dlq->pendingEntries($companyId ?: null)->take($limit);

        if ($entries->isEmpty()) {
            $this->info('DLQ is empty — nothing to drain.');

            return 0;
        }

        $this->info("Processing {$entries->count()} DLQ entries...");
        $bar = $this->output->createProgressBar($entries->count());
        $bar->start();

        $replayed = 0;
        $discarded = 0;
        $failed = 0;

        foreach ($entries as $entry) {
            if ($discard) {
                $dlq->markDiscarded($entry->id);
                $discarded++;
            } else {
                try {
                    $replayService->replayDlqEntry($entry->id);
                    $replayed++;
                } catch (Throwable $e) {
                    $this->newLine();
                    $this->warn("Failed to replay entry {$entry->id}: {$e->getMessage()}");
                    $failed++;
                }
            }
            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->table(
            ['Replayed', 'Discarded', 'Failed'],
            [[$replayed, $discarded, $failed]],
        );

        return $failed > 0 ? 1 : 0;
    }
}
