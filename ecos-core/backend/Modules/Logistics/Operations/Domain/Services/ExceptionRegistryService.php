<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Logistics\Dispatch\Domain\Models\DispatchConflict;
use Modules\Logistics\Operations\Domain\Events\OperationalExceptionRaised;
use Modules\Logistics\Operations\Domain\Events\OperationalExceptionResolved;
use Modules\Logistics\Operations\Domain\Enums\ExceptionCategory;
use Modules\Logistics\Operations\Domain\Enums\ExceptionSeverity;
use Modules\Logistics\Operations\Domain\Enums\ExceptionSource;
use Modules\Logistics\Operations\Domain\Enums\ExceptionStatus;
use Modules\Logistics\Operations\Domain\Models\OperationalException;

/**
 * The one queue an operator works, whatever produced the problem.
 *
 * ┌─ DEDUPLICATION IS THE POINT ────────────────────────────────────────────┐
 * │ A carrier outage that inserts four hundred identical rows has produced   │
 * │ zero usable information. A repeat bumps the counter and the last-seen    │
 * │ time on the live row instead.                                            │
 * │                                                                          │
 * │ Uniqueness is enforced by the index on (dedup_key, active_flag), not by  │
 * │ a read-then-write check — two listeners reacting to the same event must  │
 * │ not both win the race and both insert.                                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE CONFLICT FRAMEWORK IS REUSED, NOT REPLACED ────────────────────────┐
 * │ fromConflict() POINTS at a Phase 3 conflict and copies its wording. It   │
 * │ does not re-judge severity or authority — Dispatch already decided both, │
 * │ and a second opinion here would mean the two feeds disagree about the    │
 * │ same clash.                                                              │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class ExceptionRegistryService
{
    /**
     * Record a problem, or note that an already-known one happened again.
     *
     * @param  array<string, mixed>  $context
     */
    public function record(
        ExceptionSource $source,
        ExceptionCategory $category,
        string $exceptionType,
        ExceptionSeverity $severity,
        string $title,
        string $dedupKey,
        ?string $description = null,
        ?string $companyId = null,
        ?string $subjectType = null,
        ?string $subjectId = null,
        ?int $sourceConflictId = null,
        array $context = [],
    ): OperationalException {
        $now = Carbon::now();

        $exception = DB::transaction(function () use (
            $source, $category, $exceptionType, $severity, $title, $dedupKey,
            $description, $companyId, $subjectType, $subjectId, $sourceConflictId, $context, $now
        ) {
            $live = OperationalException::query()
                ->where('dedup_key', $dedupKey)
                ->whereNotNull('active_flag')
                ->lockForUpdate()
                ->first();

            if ($live !== null) {
                $live->increment('occurrence_count');

                $updates = ['last_seen_at' => $now];

                // A recurrence that is worse than what we recorded raises the
                // severity. It never lowers it: a problem that was critical
                // once does not become routine because the next instance was
                // milder.
                if ($severity->rank() > $live->severity->rank()) {
                    $updates['severity'] = $severity->value;
                }

                // A suppressed exception that keeps happening comes back into
                // the queue, or suppression becomes a way to lose problems.
                if ($live->status === ExceptionStatus::Suppressed) {
                    $updates['status'] = ExceptionStatus::Open->value;
                }

                $live->update($updates);

                return $live->refresh();
            }

            return OperationalException::create([
                'company_id' => $companyId,
                'source' => $source->value,
                'category' => $category->value,
                'exception_type' => $exceptionType,
                'severity' => $severity->value,
                'status' => ExceptionStatus::Open->value,
                'title' => $title,
                'description' => $description,
                'context' => $context === [] ? null : $context,
                'subject_type' => $subjectType,
                'subject_id' => $subjectId,
                'source_conflict_id' => $sourceConflictId,
                'dedup_key' => $dedupKey,
                'active_flag' => 1,
                'first_seen_at' => $now,
                'last_seen_at' => $now,
                'occurrence_count' => 1,
            ])->refresh();
        });

        // Notification only, and only for a GENUINELY NEW exception — a
        // deduplicated recurrence bumps a counter and raises nothing, so a
        // consumer counting raises counts distinct problems, not occurrences.
        if ($exception->wasRecentlyCreated) {
            OperationalExceptionRaised::dispatch(
                $exception->uuid,
                $exception->source->value,
                $exception->category->value,
                $exception->severity->value,
                $exception->exception_type,
                $exception->company_id,
                ($exception->first_seen_at ?? $now)->toIso8601String(),
            );
        }

        return $exception;
    }

    /**
     * Raise an exception from a Phase 3 conflict.
     *
     * Severity and authority are TAKEN from the conflict, never re-derived. The
     * dedup key is the conflict's own uuid, so the same clash cannot appear
     * twice in the merged queue.
     */
    public function fromConflict(DispatchConflict $conflict): OperationalException
    {
        return $this->record(
            source: ExceptionSource::from($conflict->authority()),
            category: $this->categoriseConflict($conflict),
            exceptionType: $conflict->conflict_type->value,
            // Dispatch's blocking/advisory split, mapped without re-judging it.
            severity: $conflict->conflict_type->isBlocking()
                ? ExceptionSeverity::Critical
                : ExceptionSeverity::Warning,
            title: $conflict->conflict_type->label(),
            dedupKey: 'dispatch_conflict:'.$conflict->uuid,
            // Dispatch's own wording, verbatim.
            description: $conflict->description,
            companyId: $conflict->company_id,
            subjectType: $conflict->resource_type,
            subjectId: $conflict->resource_id === null ? null : (string) $conflict->resource_id,
            sourceConflictId: $conflict->id,
            context: ['conflict_uuid' => $conflict->uuid],
        );
    }

    /**
     * Close an exception because the condition it described has cleared.
     *
     * Distinct from a human resolution so the statistics do not credit anyone
     * with work that resolved itself.
     */
    public function autoResolve(OperationalException $exception, string $why): OperationalException
    {
        if (! $exception->status->canTransitionTo(ExceptionStatus::AutoResolved)) {
            return $exception;
        }

        $exception->update([
            'status' => ExceptionStatus::AutoResolved->value,
            'resolved_at' => Carbon::now(),
            'resolution' => OperationalException::RESOLUTION_NOT_A_PROBLEM,
            'resolution_reason' => $why,
            // Freeing the dedup key lets the same problem be raised afresh if
            // it comes back, rather than silently reopening an old row.
            'active_flag' => null,
        ]);

        $resolved = $exception->refresh();

        // Notification only. The AutoResolved status tells a consumer the
        // condition cleared on its own — nobody did the work.
        OperationalExceptionResolved::dispatch(
            $resolved->uuid,
            $resolved->source->value,
            $resolved->status->value,
            $resolved->resolution,
            $resolved->company_id,
            ($resolved->resolved_at ?? Carbon::now())->toIso8601String(),
        );

        return $resolved;
    }

    /**
     * Exceptions whose originating conflict has since been settled.
     *
     * Dispatch owns that judgement; this only follows it. Returns how many were
     * closed.
     */
    public function reconcileResolvedConflicts(): int
    {
        $candidates = OperationalException::query()
            ->whereNotNull('source_conflict_id')
            ->whereNotNull('active_flag')
            ->with('sourceConflict')
            ->get();

        $closed = 0;

        foreach ($candidates as $exception) {
            $conflict = $exception->sourceConflict;

            if ($conflict === null || $conflict->isOutstanding()) {
                continue;
            }

            $this->autoResolve(
                $exception,
                'The dispatch conflict behind this was settled in Dispatch.'
            );

            $closed++;
        }

        return $closed;
    }

    private function categoriseConflict(DispatchConflict $conflict): ExceptionCategory
    {
        return match ($conflict->conflict_type->value) {
            'vehicle_unfit', 'driver_unavailable' => ExceptionCategory::Resource,
            'capacity_exceeded' => ExceptionCategory::Capacity,
            'policy_violation' => ExceptionCategory::Policy,
            default => ExceptionCategory::Dispatch,
        };
    }
}
