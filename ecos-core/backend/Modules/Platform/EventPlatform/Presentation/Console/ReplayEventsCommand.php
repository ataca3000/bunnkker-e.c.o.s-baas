<?php

declare(strict_types=1);

namespace Modules\Platform\EventPlatform\Presentation\Console;

use DateTimeImmutable;
use Illuminate\Console\Command;
use Modules\Platform\EventPlatform\Application\Services\EnterpriseEventReplayService;

class ReplayEventsCommand extends Command
{
    protected $signature = 'event-platform:replay
        {--event-id= : Replay a single event by stored_event ID}
        {--aggregate-type= : Replay all events for an aggregate type}
        {--aggregate-id= : Replay all events for an aggregate ID (requires --aggregate-type)}
        {--module= : Replay all events from a module}
        {--from= : Start of time range (ISO8601)}
        {--to= : End of time range (ISO8601)}
        {--company-id= : Filter by company}
        {--dlq-entry= : Replay a specific DLQ entry}';

    protected $description = 'Replay enterprise events from the event store';

    public function handle(EnterpriseEventReplayService $replayService): int
    {
        if ($eventId = $this->option('event-id')) {
            $this->info("Replaying event: {$eventId}");
            $replayService->replaySingle($eventId);
            $this->info('Done.');

            return 0;
        }

        if ($dlqEntry = $this->option('dlq-entry')) {
            $this->info("Replaying DLQ entry: {$dlqEntry}");
            $replayService->replayDlqEntry($dlqEntry);
            $this->info('Done.');

            return 0;
        }

        if ($aggregateType = $this->option('aggregate-type')) {
            $aggregateId = $this->option('aggregate-id') ?? $this->ask('Aggregate ID?');
            $this->info("Replaying aggregate {$aggregateType}/{$aggregateId}");
            $count = $replayService->replayByAggregate($aggregateType, $aggregateId);
            $this->info("Replayed {$count} events.");

            return 0;
        }

        if ($module = $this->option('module')) {
            $this->info("Replaying module: {$module}");
            $count = $replayService->replayByModule($module, $this->option('company-id'));
            $this->info("Replayed {$count} events.");

            return 0;
        }

        if ($from = $this->option('from')) {
            $to = $this->option('to') ?? now()->toIso8601String();
            $filters = [];
            if ($companyId = $this->option('company-id')) {
                $filters['company_id'] = $companyId;
            }
            $this->info("Replaying time range: {$from} → {$to}");
            $count = $replayService->replayByTimeRange(
                new DateTimeImmutable($from),
                new DateTimeImmutable($to),
                $filters,
            );
            $this->info("Replayed {$count} events.");

            return 0;
        }

        $this->error('No replay target specified. Use --event-id, --aggregate-type, --module, --from, or --dlq-entry.');

        return 1;
    }
}
