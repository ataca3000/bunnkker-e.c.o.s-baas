<?php

declare(strict_types=1);

namespace Modules\Platform\EventPlatform\Presentation\Console;

use Illuminate\Console\Command;
use Modules\Platform\EventPlatform\Application\Services\EnterpriseEventMonitor;

class EventMonitorCommand extends Command
{
    protected $signature = 'event-platform:monitor
        {--company-id= : Scope stats to a specific company}
        {--watch : Re-display every 5 seconds until interrupted}';

    protected $description = 'Display Enterprise Event Platform monitoring stats';

    public function handle(EnterpriseEventMonitor $monitor): int
    {
        $companyId = $this->option('company-id') ?: null;
        $watch = $this->option('watch');

        do {
            $stats = $monitor->getSnapshot($companyId);
            $this->displayStats($stats);

            if ($watch) {
                sleep(5);
                $this->output->write("\033[2J\033[0;0H"); // Clear screen
            }
        } while ($watch);

        return 0;
    }

    private function displayStats(array $stats): void
    {
        $this->info('=== ECOS Enterprise Event Platform Monitor ===');
        $this->line('Generated: '.$stats['generated_at']);
        $this->newLine();

        $this->table(
            ['Metric', 'Value'],
            [
                ['Published',         number_format($stats['published'])],
                ['Processing',        number_format($stats['processing'])],
                ['Succeeded',         number_format($stats['succeeded'])],
                ['Failed',            number_format($stats['failed'])],
                ['Retried',           number_format($stats['retried'])],
                ['Dead Letter Queue', number_format($stats['dead_letter'])],
                ['Replayed',          number_format($stats['replayed'])],
                ['Avg Processing',    $stats['avg_processing_ms'] !== null
                    ? number_format($stats['avg_processing_ms'], 2).' ms'
                    : 'N/A'],
                ['Active Subscribers', number_format($stats['active_subscribers'])],
            ],
        );
    }
}
