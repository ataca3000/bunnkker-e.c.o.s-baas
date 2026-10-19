<?php

declare(strict_types=1);

namespace Modules\Finance\Integration\Application\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Modules\Finance\Integration\Domain\Services\DeadLetterService;
use Modules\Finance\Integration\Domain\Services\FinancialEventProcessor;
use Modules\Finance\Integration\Domain\ValueObjects\FinancialEvent;

/**
 * Asynchronous posting — the queued path for high-volume operational streams
 * (POS, shipping). The event is carried as a plain array so the job is trivially
 * serialisable and replayable.
 *
 * Idempotency makes retries safe: a re-run resolves to the existing journal
 * rather than double-posting. Business failures are dead-lettered by the
 * processor; a hard job failure is caught by failed() and dead-lettered too, so
 * an event is never silently lost.
 */
final class ProcessFinancialEventJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    /** @var array<string, mixed> */
    private array $payload;

    public function __construct(FinancialEvent $event)
    {
        $this->payload = $event->toArray();
        $this->onQueue('finance-posting');
    }

    /** @return list<int> */
    public function backoff(): array
    {
        return [10, 30, 60];
    }

    public function handle(FinancialEventProcessor $processor): void
    {
        $processor->process(FinancialEvent::fromArray($this->payload));
    }

    public function failed(\Throwable $e): void
    {
        // A hard infrastructure failure that exhausted retries — capture the
        // event so it is never lost, replayable once the cause is fixed.
        app(DeadLetterService::class)->record(
            FinancialEvent::fromArray($this->payload),
            'Job failed after retries: '.$e->getMessage(),
        );
    }
}
