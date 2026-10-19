<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Logistics\Delivery\Domain\Contracts\DeliveryRepositoryInterface;
use Modules\Logistics\Delivery\Domain\Enums\AttemptStatus;
use Modules\Logistics\Delivery\Domain\Enums\DeliveryStatus;
use Modules\Logistics\Delivery\Domain\Enums\FailureReason;
use Modules\Logistics\Delivery\Domain\Events\DeliveryAttemptStarted;
use Modules\Logistics\Delivery\Domain\Events\DeliveryCreated;
use Modules\Logistics\Delivery\Domain\Events\DeliveryFailed;
use Modules\Logistics\Delivery\Domain\Events\DeliveryPartiallySucceeded;
use Modules\Logistics\Delivery\Domain\Events\DeliveryRetryExhausted;
use Modules\Logistics\Delivery\Domain\Events\DeliveryRetryScheduled;
use Modules\Logistics\Delivery\Domain\Events\DeliverySucceeded;
use Modules\Logistics\Delivery\Domain\Events\SlaBreached;
use Modules\Logistics\Delivery\Domain\Exceptions\DeliveryException;
use Modules\Logistics\Delivery\Domain\Models\Delivery;
use Modules\Logistics\Delivery\Domain\Models\DeliveryAttempt;
use Modules\Logistics\Delivery\Domain\Models\DeliveryFailure;
use Modules\Logistics\Delivery\Domain\Models\TrackingEvent;
use Modules\Logistics\Distribution\Domain\Models\DeliveryStop;

/**
 * The delivery lifecycle: attempts, outcomes, failures and retry.
 *
 * Driver and vehicle readiness is DELEGATED to the aggregates that own it —
 * this service never re-derives whether a driver may drive.
 */
class DeliveryExecutionService
{
    public function __construct(
        private readonly DeliveryRepositoryInterface $deliveries,
        private readonly TrackingProjectionService $tracking,
        private readonly PodValidationService $pods,
    ) {}

    /** @param array<string, mixed> $attributes */
    public function create(array $attributes, ?string $actor = null): Delivery
    {
        $delivery = DB::transaction(fn () => $this->deliveries->create($attributes));

        $this->tracking->recordCustomerVisible(
            $delivery,
            'delivery.created',
            'Order received',
            'Your order has been received and is being prepared for delivery.',
        );

        DeliveryCreated::dispatch($delivery, $actor);

        return $delivery;
    }

    public function changeStatus(
        Delivery $delivery,
        DeliveryStatus $target,
        ?string $actor = null,
    ): Delivery {
        $current = $delivery->status;

        if ($current === $target) {
            return $delivery;
        }

        if (! $current->canTransitionTo($target)) {
            throw DeliveryException::invalidDeliveryTransition($current, $target);
        }

        return DB::transaction(fn () => $this->deliveries->update($delivery, ['status' => $target->value]));
    }

    // ── Attempts ──────────────────────────────────────────────────────────────

    /**
     * Open an attempt against a Distribution stop.
     *
     * BR-1/2/3: the trip must be on the road, driver and vehicle must pass
     * their own gates, and only one attempt may be open at a time.
     */
    public function openAttempt(
        Delivery $delivery,
        DeliveryStop $stop,
        ?int $actorId = null,
        ?string $actor = null,
    ): DeliveryAttempt {
        if ($delivery->isTerminal()) {
            throw DeliveryException::deliveryNotAcceptingAttempts($delivery->status);
        }

        if ($delivery->hasOpenAttempt()) {
            throw DeliveryException::attemptAlreadyOpen();
        }

        $trip = $stop->trip;

        if ($trip === null || ! $trip->status->acceptsDeliveryExecution()) {
            throw DeliveryException::tripNotOnTheRoad();
        }

        // Delegated readiness — Drivers (LOG-002) and Vehicles (LOG-003) own these.
        $assignment = $trip->driverVehicleAssignment;
        if ($assignment !== null) {
            if ($assignment->driver !== null && ! $assignment->driver->canStartDeliveries()) {
                throw DeliveryException::driverCannotDeliver();
            }
            if ($assignment->vehicle !== null && ! $assignment->vehicle->canBeDispatched()) {
                throw DeliveryException::vehicleCannotDeliver();
            }
        }

        $attempt = DB::transaction(function () use ($delivery, $stop, $trip, $actorId) {
            $attempt = $delivery->attempts()->create([
                'stop_id' => $stop->id,
                'trip_id' => $trip->id,
                'attempt_no' => $delivery->attempt_count + 1,
                'status' => AttemptStatus::Created->value,
                'performed_by' => $actorId,
            ]);

            $this->deliveries->update($delivery, [
                'attempt_count' => $delivery->attempt_count + 1,
                'current_stop_id' => $stop->id,
                'status' => DeliveryStatus::OutForDelivery->value,
            ]);

            return $attempt;
        });

        $this->tracking->recordCustomerVisible(
            $delivery->refresh(),
            'delivery.out_for_delivery',
            'Out for delivery',
            'Your order is on its way.',
            $attempt,
        );

        DeliveryAttemptStarted::dispatch($delivery->refresh(), $attempt, $actor);

        return $attempt;
    }

    public function advanceAttempt(
        DeliveryAttempt $attempt,
        AttemptStatus $target,
        array $attributes = [],
        ?string $actor = null,
    ): DeliveryAttempt {
        if (! $attempt->status->canTransitionTo($target)) {
            throw DeliveryException::invalidAttemptTransition($attempt->status, $target);
        }

        $stamp = match ($target) {
            AttemptStatus::EnRoute => ['en_route_at' => now()],
            AttemptStatus::Arrived => ['arrived_at' => now()],
            AttemptStatus::InProgress => ['started_at' => now()],
            default => [],
        };

        $updated = DB::transaction(function () use ($attempt, $target, $attributes, $stamp) {
            $attempt->update($attributes + $stamp + ['status' => $target->value]);

            return $attempt->refresh();
        });

        if ($target === AttemptStatus::Arrived) {
            $this->tracking->recordCustomerVisible(
                $updated->delivery,
                'delivery.arrived',
                'Driver has arrived',
                'The driver has arrived at your address.',
                $updated,
            );
        }

        return $updated;
    }

    // ── Outcomes ──────────────────────────────────────────────────────────────

    /**
     * Close an attempt successfully.
     *
     * BR-7: a validated POD is required when the policy demands one.
     * BR-8: no outstanding COD may remain.
     */
    public function succeed(
        DeliveryAttempt $attempt,
        bool $partial = false,
        ?int $actorId = null,
        ?string $actor = null,
    ): DeliveryAttempt {
        if (! $attempt->status->canTransitionTo(AttemptStatus::Succeeded)) {
            throw DeliveryException::invalidAttemptTransition($attempt->status, AttemptStatus::Succeeded);
        }

        $delivery = $attempt->delivery;

        $pod = $attempt->pod;
        if ($pod === null || ! $pod->isValidated()) {
            throw DeliveryException::podNotValidated();
        }

        $cod = $delivery->codRecord;
        if ($cod !== null) {
            if ($cod->isOutstanding()) {
                throw DeliveryException::codOutstanding((float) $cod->amount_due, $cod->currency);
            }
            if ($cod->blocksClosure()) {
                throw DeliveryException::codDisputed();
            }
        }

        $updated = DB::transaction(function () use ($attempt, $delivery, $partial) {
            $attempt->update([
                'status' => AttemptStatus::Succeeded->value,
                'closed_at' => now(),
            ]);

            $target = $partial ? DeliveryStatus::PartiallyDelivered : DeliveryStatus::Delivered;

            $this->deliveries->update($delivery, [
                'status' => $target->value,
                'delivered_at' => now(),
                'sla_breached' => $delivery->isSlaBreached(Carbon::now()),
            ]);

            return $attempt->refresh();
        });

        $delivery->refresh();

        $this->tracking->recordCustomerVisible(
            $delivery,
            $partial ? 'delivery.partially_delivered' : 'delivery.delivered',
            $partial ? 'Partially delivered' : 'Delivered',
            $partial
                ? 'Part of your order was delivered; the remainder is being returned.'
                : 'Your order has been delivered. Thank you.',
            $updated,
        );

        if ($partial) {
            DeliveryPartiallySucceeded::dispatch($delivery, $updated, $actor);
        } else {
            DeliverySucceeded::dispatch($delivery, $updated, $actor);
        }

        if ($delivery->sla_breached) {
            SlaBreached::dispatch($delivery, $actor);
        }

        return $updated;
    }

    /**
     * Close an attempt as failed and decide what happens next.
     *
     * Retryability comes from the taxonomy, never from the caller, so the same
     * decision is reached regardless of which client reported the failure.
     */
    public function fail(
        DeliveryAttempt $attempt,
        FailureReason $reason,
        ?string $description = null,
        array $photos = [],
        ?int $actorId = null,
        ?string $actor = null,
    ): DeliveryFailure {
        if (! $attempt->status->canTransitionTo(AttemptStatus::Failed)) {
            throw DeliveryException::invalidAttemptTransition($attempt->status, AttemptStatus::Failed);
        }

        $delivery = $attempt->delivery;

        $failure = DB::transaction(function () use ($attempt, $delivery, $reason, $description, $photos, $actorId) {
            $attempt->update([
                'status' => AttemptStatus::Failed->value,
                'closed_at' => now(),
            ]);

            $failure = DeliveryFailure::create([
                'delivery_id' => $delivery->id,
                'attempt_id' => $attempt->id,
                'reason_code' => $reason->value,
                'category' => $reason->category()->value,
                'is_retryable' => $reason->isRetryable(),
                'requires_address_correction' => $reason->requiresAddressCorrection(),
                'description' => $description,
                'photos' => $photos === [] ? null : $photos,
                'reported_by' => $actorId,
            ]);

            $this->deliveries->update($delivery, [
                'status' => DeliveryStatus::Failed->value,
                'requires_address_correction' => $reason->requiresAddressCorrection()
                    ? true
                    : $delivery->requires_address_correction,
            ]);

            return $failure;
        });

        $delivery->refresh();

        $this->tracking->recordCustomerVisible(
            $delivery,
            'delivery.failed',
            'Delivery attempt unsuccessful',
            $reason->label(),
            $attempt,
        );

        DeliveryFailed::dispatch($delivery, $attempt->refresh(), $failure, $actor);

        // Decide the next step immediately so the delivery never idles in Failed.
        if ($delivery->canRetry()) {
            $this->scheduleRetry($delivery, $actor);
        } else {
            $this->exhaustRetries($delivery, $actor);
        }

        return $failure;
    }

    public function abortAttempt(DeliveryAttempt $attempt, ?string $reason = null): DeliveryAttempt
    {
        if (! $attempt->status->canTransitionTo(AttemptStatus::Aborted)) {
            throw DeliveryException::invalidAttemptTransition($attempt->status, AttemptStatus::Aborted);
        }

        $attempt->update([
            'status' => AttemptStatus::Aborted->value,
            'closed_at' => now(),
            'notes' => $reason ?? $attempt->notes,
        ]);

        return $attempt->refresh();
    }

    // ── Retry ─────────────────────────────────────────────────────────────────

    public function scheduleRetry(Delivery $delivery, ?string $actor = null): Delivery
    {
        $blockers = $delivery->retryBlockers();

        if ($blockers !== []) {
            throw DeliveryException::retryBlocked($blockers);
        }

        $updated = DB::transaction(fn () => $this->deliveries->update($delivery, [
            'status' => DeliveryStatus::AwaitingRetry->value,
        ]));

        $this->tracking->recordCustomerVisible(
            $updated,
            'delivery.retry_scheduled',
            'Redelivery scheduled',
            'We will attempt your delivery again.',
        );

        DeliveryRetryScheduled::dispatch($updated, $actor);

        return $updated;
    }

    /** No retries remain — the goods go back. */
    public function exhaustRetries(Delivery $delivery, ?string $actor = null): Delivery
    {
        $updated = DB::transaction(fn () => $this->deliveries->update($delivery, [
            'status' => DeliveryStatus::Returning->value,
            'escalation_level' => max(1, $delivery->escalation_level),
        ]));

        $this->tracking->record(
            $updated,
            'delivery.retry_exhausted',
            'Retries exhausted',
            'No further attempts are possible; the order is being returned.',
            TrackingEvent::VISIBILITY_INTERNAL,
        );

        DeliveryRetryExhausted::dispatch($updated, $actor);

        return $updated;
    }

    /** BR-11: clears the block an address failure placed on retry. */
    public function markAddressCorrected(Delivery $delivery, ?string $actor = null): Delivery
    {
        return DB::transaction(fn () => $this->deliveries->update($delivery, [
            'address_corrected_at' => now(),
            'requires_address_correction' => false,
        ]));
    }

    public function cancel(Delivery $delivery, ?string $reason = null, ?string $actor = null): Delivery
    {
        if (! $delivery->status->canTransitionTo(DeliveryStatus::Cancelled)) {
            throw DeliveryException::invalidDeliveryTransition($delivery->status, DeliveryStatus::Cancelled);
        }

        $updated = DB::transaction(fn () => $this->deliveries->update($delivery, [
            'status' => DeliveryStatus::Cancelled->value,
            'notes' => $reason ?? $delivery->notes,
        ]));

        $this->tracking->recordCustomerVisible(
            $updated,
            'delivery.cancelled',
            'Delivery cancelled',
            $reason,
        );

        return $updated;
    }

    /** Escalation ladder — L1 operations, L2 supervisor, L3 management. */
    public function escalate(Delivery $delivery): Delivery
    {
        return DB::transaction(fn () => $this->deliveries->update($delivery, [
            'escalation_level' => min(3, $delivery->escalation_level + 1),
        ]));
    }
}
