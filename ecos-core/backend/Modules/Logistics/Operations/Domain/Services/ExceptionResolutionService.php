<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Logistics\Operations\Domain\Enums\ExceptionStatus;
use Modules\Logistics\Operations\Domain\Events\OperationalExceptionResolved;
use Modules\Logistics\Operations\Domain\Exceptions\OperationsException;
use Modules\Logistics\Operations\Domain\Models\ExceptionNote;
use Modules\Logistics\Operations\Domain\Models\OperationalException;

/**
 * Acknowledging, annotating and closing an exception.
 *
 * ┌─ OPERATIONS CANNOT MAKE ANOTHER MODULE'S FACT UNTRUE ───────────────────┐
 * │ An exception sourced from Fleet describes a vehicle Fleet says is unfit. │
 * │ Closing the row here would not put the vehicle back on the road; it      │
 * │ would only stop anyone being told.                                       │
 * │                                                                          │
 * │ So resolve() refuses unless the exception is either Operations' own, or  │
 * │ closed as HANDLED_ELSEWHERE — which states plainly that the fix          │
 * │ happened in the owning module and this row is merely being tidied.       │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class ExceptionResolutionService
{
    public function acknowledge(
        OperationalException $exception,
        ?int $actorId = null,
        ?string $actorName = null,
    ): OperationalException {
        $this->assertTransition($exception, ExceptionStatus::Acknowledged);

        $exception->update([
            'status' => ExceptionStatus::Acknowledged->value,
            'acknowledged_at' => Carbon::now(),
            'acknowledged_by' => $actorId,
            'acknowledged_by_name' => $actorName,
        ]);

        return $exception->refresh();
    }

    /**
     * Close it.
     *
     * The reason is mandatory. An exception closed with no note is one the next
     * person cannot learn anything from, and the same problem arrives again
     * next week with nobody the wiser.
     */
    public function resolve(
        OperationalException $exception,
        string $resolution,
        string $reason,
        ?int $actorId = null,
        ?string $actorName = null,
    ): OperationalException {
        $this->assertTransition($exception, ExceptionStatus::Resolved);

        if (trim($reason) === '') {
            throw OperationsException::resolutionReasonRequired();
        }

        // Someone else's fact can only be closed by saying so explicitly.
        if (! $exception->isSelfOwned()
            && $resolution !== OperationalException::RESOLUTION_HANDLED_ELSEWHERE) {
            throw OperationsException::notOurExceptionToResolve($exception->source);
        }

        $exception->update([
            'status' => ExceptionStatus::Resolved->value,
            'resolved_at' => Carbon::now(),
            'resolved_by' => $actorId,
            'resolved_by_name' => $actorName,
            'resolution' => $resolution,
            'resolution_reason' => $reason,
            // Free the dedup key: a recurrence should raise a fresh exception
            // rather than quietly reopening a closed one.
            'active_flag' => null,
        ]);

        $resolved = $exception->refresh();

        // Notification only — fired after the close is committed. The Resolved
        // status marks a human resolution, distinct from an auto-resolution.
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
     * Stop it shouting without pretending it is gone.
     *
     * A suppressed exception that keeps happening is put back in the queue by
     * ExceptionRegistryService — suppression must not become a way to lose
     * problems permanently.
     */
    public function suppress(
        OperationalException $exception,
        string $reason,
        ?int $actorId = null,
        ?string $actorName = null,
    ): OperationalException {
        $this->assertTransition($exception, ExceptionStatus::Suppressed);

        if (trim($reason) === '') {
            throw OperationsException::resolutionReasonRequired();
        }

        $exception->update([
            'status' => ExceptionStatus::Suppressed->value,
            'resolution_reason' => $reason,
        ]);

        $this->addNote(
            $exception,
            "Suppressed: {$reason}",
            ExceptionNote::TYPE_ACTION,
            actorId: $actorId,
            actorName: $actorName,
        );

        return $exception->refresh();
    }

    // ── Operational notes ────────────────────────────────────────────────────

    /**
     * Add to the running commentary.
     *
     * Append-only at the model. The value is the sequence — what was tried,
     * what was ruled out — and editing it rewrites the reasoning.
     */
    public function addNote(
        OperationalException $exception,
        string $body,
        string $type = ExceptionNote::TYPE_NOTE,
        bool $pinned = false,
        ?int $actorId = null,
        ?string $actorName = null,
    ): ExceptionNote {
        if (trim($body) === '') {
            throw OperationsException::noteBodyRequired();
        }

        return ExceptionNote::create([
            'company_id' => $exception->company_id,
            'exception_id' => $exception->id,
            'body' => trim($body),
            'note_type' => $type,
            'is_pinned' => $pinned,
            'written_at' => Carbon::now(),
            'author_id' => $actorId,
            'author_name' => $actorName,
        ]);
    }

    /**
     * The commentary, pinned first then newest.
     *
     * A handover note is what the next shift must read before anything else, so
     * it does not get buried under an hour of routine updates.
     *
     * @return list<ExceptionNote>
     */
    public function notesFor(OperationalException $exception): array
    {
        return $exception->notes()
            ->orderByDesc('is_pinned')
            ->orderByDesc('written_at')
            ->get()
            ->all();
    }

    private function assertTransition(OperationalException $exception, ExceptionStatus $target): void
    {
        if (! $exception->status->canTransitionTo($target)) {
            throw OperationsException::invalidExceptionTransition($exception->status, $target);
        }
    }
}
