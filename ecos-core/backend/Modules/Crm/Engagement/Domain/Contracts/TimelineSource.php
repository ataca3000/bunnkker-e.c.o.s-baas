<?php

declare(strict_types=1);

namespace Modules\Crm\Engagement\Domain\Contracts;

use Illuminate\Support\Carbon;

/**
 * A source of timeline entries.
 *
 * ┌─ READ FROM EXISTING SYSTEMS · NO DUPLICATION · NO COUPLING ─────────────┐
 * │ The CRM owns only CRM activities. Every OTHER interaction (conversations,  │
 * │ orders) is contributed by a source that READS the existing system's data —  │
 * │ live, at read time — and maps it to timeline entries. A source reads by     │
 * │ table, so the CRM depends on NO operational module's code, and never copies │
 * │ business data. A source that cannot read (table absent) simply returns [].  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
interface TimelineSource
{
    /** A stable identifier for the source (e.g. "customer_engagement"). */
    public function key(): string;

    /**
     * Timeline entries for a customer, optionally bounded to a window.
     *
     * @return list<\Modules\Crm\Engagement\Domain\ValueObjects\TimelineEntry>
     */
    public function entries(string $companyId, string $customerId, ?Carbon $from = null, ?Carbon $to = null): array;
}
