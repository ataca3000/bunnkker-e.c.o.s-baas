<?php

declare(strict_types=1);

namespace Modules\Finance\Integration\Application\Services;

use Modules\Finance\Integration\Application\Jobs\ProcessFinancialEventJob;
use Modules\Finance\Integration\Domain\Services\FinancialEventProcessor;
use Modules\Finance\Integration\Domain\ValueObjects\FinancialEvent;
use Modules\Finance\Integration\Domain\ValueObjects\PostingOutcome;

/**
 * The single sanctioned seam an operational module uses to reach Finance.
 *
 * ┌─ OPERATIONS TALKS TO FINANCE ONLY THROUGH HERE ─────────────────────────┐
 * │ A module never touches the ledger, the posting engine, or a journal — it  │
 * │ hands over a normalized FinancialEvent and this service does the rest,     │
 * │ synchronously (record) or on the queue (recordAsync). This is the one      │
 * │ import an operational module needs; everything behind it — rules,          │
 * │ accounts, idempotency, audit, dead-letter — is Finance's concern.          │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class FinancialIntegrationService
{
    public function __construct(private readonly FinancialEventProcessor $processor) {}

    /** Post synchronously and return the outcome. */
    public function record(FinancialEvent $event): PostingOutcome
    {
        return $this->processor->process($event);
    }

    /** Enqueue for asynchronous posting — the path for high-volume streams. */
    public function recordAsync(FinancialEvent $event): void
    {
        ProcessFinancialEventJob::dispatch($event);
    }

    /** Preview the journal an event would produce, without posting. */
    public function preview(FinancialEvent $event): array
    {
        return $this->processor->preview($event);
    }
}
