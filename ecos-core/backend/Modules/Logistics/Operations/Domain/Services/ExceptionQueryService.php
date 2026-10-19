<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Modules\Logistics\Operations\Domain\Enums\ExceptionCategory;
use Modules\Logistics\Operations\Domain\Enums\ExceptionSeverity;
use Modules\Logistics\Operations\Domain\Enums\ExceptionSource;
use Modules\Logistics\Operations\Domain\Enums\ExceptionStatus;
use Modules\Logistics\Operations\Domain\Models\OperationalException;

/**
 * Reading the registry.
 *
 * Separated from the services that WRITE it, so a read path can never
 * accidentally mutate an exception while rendering a dashboard.
 *
 * The default ordering is the order an operator would work the queue: loudest
 * first, then longest waiting. Sorting by recency would bury a critical problem
 * from an hour ago under a stream of routine noise.
 */
class ExceptionQueryService
{
    /**
     * @param  array<string, mixed>  $filters
     */
    /**
     * Severity has no natural string ordering, so the rank is expressed in SQL.
     *
     * A portable CASE rather than MySQL's FIELD(): the same query has to run on
     * PostgreSQL, and a helper that silently only works on one engine is a trap
     * for whoever ports it.
     */
    private const SEVERITY_ORDER = "CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END";

    public function paginate(array $filters = [], int $perPage = 25): LengthAwarePaginator
    {
        return $this->query($filters)
            ->orderByRaw(self::SEVERITY_ORDER)
            ->orderBy('first_seen_at')
            ->paginate(max(1, min($perPage, 100)));
    }

    /**
     * Everything still in somebody's queue.
     *
     * @param  array<string, mixed>  $filters
     * @return list<OperationalException>
     */
    public function outstanding(array $filters = []): array
    {
        return $this->query($filters + ['outstanding_only' => true])
            ->orderByRaw(self::SEVERITY_ORDER)
            ->orderBy('first_seen_at')
            ->get()
            ->all();
    }

    /**
     * Counts for the exception strip.
     *
     * @return array<string, mixed>
     */
    public function summary(?string $companyId = null, ?Carbon $at = null): array
    {
        $at ??= Carbon::now();

        $outstanding = OperationalException::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->whereIn('status', [
                ExceptionStatus::Open->value,
                ExceptionStatus::Acknowledged->value,
                ExceptionStatus::Escalated->value,
            ])
            ->get();

        $bySource = [];
        $byCategory = [];

        foreach ($outstanding as $exception) {
            $source = $exception->source->value;
            $category = $exception->category->value;

            $bySource[$source] = ($bySource[$source] ?? 0) + 1;
            $byCategory[$category] = ($byCategory[$category] ?? 0) + 1;
        }

        $ages = $outstanding->map(static fn (OperationalException $e) => $e->ageMinutes($at));

        return [
            'outstanding' => $outstanding->count(),
            // Nobody has looked at these yet — the number that drives the day.
            'needs_attention' => $outstanding->filter(
                static fn (OperationalException $e) => $e->needsAttention()
            )->count(),
            'critical' => $outstanding->where('severity', ExceptionSeverity::Critical)->count(),
            'escalated' => $outstanding->where('status', ExceptionStatus::Escalated)->count(),
            'by_source' => $bySource,
            'by_category' => $byCategory,
            // Null, not zero: an empty queue has no oldest item, and reporting
            // "0 minutes" reads as "something just arrived".
            'oldest_minutes' => $ages->isEmpty() ? null : (int) $ages->max(),
            'overdue_for_escalation' => $outstanding->filter(
                static fn (OperationalException $e) => $e->isOverdueForEscalation($at)
            )->count(),
            // Repeats are the signal that a problem is systemic rather than a
            // one-off, so they are counted separately.
            'recurring' => $outstanding->filter(
                static fn (OperationalException $e) => $e->occurrence_count > 1
            )->count(),
        ];
    }

    /** @param array<string, mixed> $filters */
    private function query(array $filters): \Illuminate\Database\Eloquent\Builder
    {
        return OperationalException::query()
            ->when(
                ($filters['company_id'] ?? null) !== null,
                fn ($q) => $q->where('company_id', $filters['company_id']),
            )
            ->when(
                ($filters['status'] ?? null) !== null,
                fn ($q) => $q->where('status', ExceptionStatus::from($filters['status'])->value),
            )
            ->when(
                ($filters['outstanding_only'] ?? false) === true,
                fn ($q) => $q->whereIn('status', [
                    ExceptionStatus::Open->value,
                    ExceptionStatus::Acknowledged->value,
                    ExceptionStatus::Escalated->value,
                ]),
            )
            ->when(
                ($filters['source'] ?? null) !== null,
                fn ($q) => $q->where('source', ExceptionSource::from($filters['source'])->value),
            )
            ->when(
                ($filters['category'] ?? null) !== null,
                fn ($q) => $q->where('category', ExceptionCategory::from($filters['category'])->value),
            )
            ->when(
                ($filters['severity'] ?? null) !== null,
                fn ($q) => $q->where('severity', ExceptionSeverity::from($filters['severity'])->value),
            )
            ->when(
                ($filters['search'] ?? null) !== null,
                fn ($q) => $q->where('title', 'like', '%'.$filters['search'].'%'),
            );
    }
}
