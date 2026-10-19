<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Exceptions;

use Modules\Logistics\Fleet\Domain\Enums\DefectStatus;
use Modules\Logistics\Fleet\Domain\Enums\FleetUnitLifecycle;
use Modules\Logistics\Fleet\Domain\Enums\FuelTransactionStatus;
use Modules\Logistics\Fleet\Domain\Enums\InspectionStatus;
use Modules\Logistics\Fleet\Domain\Enums\WorkOrderStatus;
use RuntimeException;

/** Raised when an operation would violate a Fleet business rule. Rendered as 422. */
class FleetException extends RuntimeException
{
    public static function invalidLifecycleTransition(FleetUnitLifecycle $from, FleetUnitLifecycle $to): self
    {
        $allowed = array_map(static fn (FleetUnitLifecycle $s) => $s->label(), $from->allowedTransitions());

        return new self(sprintf(
            'A fleet unit cannot move from %s to %s. Allowed next states: %s.',
            $from->label(),
            $to->label(),
            $allowed === [] ? 'none — this state is terminal' : implode(', ', $allowed),
        ));
    }

    public static function invalidWorkOrderTransition(WorkOrderStatus $from, WorkOrderStatus $to): self
    {
        $allowed = array_map(static fn (WorkOrderStatus $s) => $s->label(), $from->allowedTransitions());

        return new self(sprintf(
            'A work order cannot move from %s to %s. Allowed next states: %s.',
            $from->label(),
            $to->label(),
            $allowed === [] ? 'none — this state is final' : implode(', ', $allowed),
        ));
    }

    public static function invalidInspectionTransition(InspectionStatus $from, InspectionStatus $to): self
    {
        $allowed = array_map(static fn (InspectionStatus $s) => $s->label(), $from->allowedTransitions());

        return new self(sprintf(
            'An inspection cannot move from %s to %s. Allowed next states: %s.',
            $from->label(),
            $to->label(),
            $allowed === [] ? 'none — this state is final' : implode(', ', $allowed),
        ));
    }

    public static function invalidDefectTransition(DefectStatus $from, DefectStatus $to): self
    {
        $allowed = array_map(static fn (DefectStatus $s) => $s->label(), $from->allowedTransitions());

        return new self(sprintf(
            'A defect cannot move from %s to %s. Allowed next states: %s.',
            $from->label(),
            $to->label(),
            $allowed === [] ? 'none — this state is final' : implode(', ', $allowed),
        ));
    }

    public static function invalidFuelTransition(FuelTransactionStatus $from, FuelTransactionStatus $to): self
    {
        $allowed = array_map(static fn (FuelTransactionStatus $s) => $s->label(), $from->allowedTransitions());

        return new self(sprintf(
            'A fuel transaction cannot move from %s to %s. Allowed next states: %s.',
            $from->label(),
            $to->label(),
            $allowed === [] ? 'none — this state is final' : implode(', ', $allowed),
        ));
    }

    // ── Lifecycle guards ──────────────────────────────────────────────────────

    public static function fleetUnitAlreadyExists(int $vehicleId): self
    {
        return new self(
            "Vehicle {$vehicleId} already has a fleet unit. A vehicle may belong to exactly one."
        );
    }

    public static function commissioningRequiresPassedInspection(): self
    {
        return new self(
            'A fleet unit cannot become active until a commissioning inspection has been approved.'
        );
    }

    public static function retirementBlocked(array $reasons): self
    {
        return new self('This unit cannot be retired yet: '.implode(' ', $reasons));
    }

    public static function lifecycleReasonRequired(FleetUnitLifecycle $target): self
    {
        return new self("Moving to {$target->label()} requires a reason.");
    }

    // ── Maintenance guards ────────────────────────────────────────────────────

    /** Directive 5 / D3: telemetry is optional, so a plan must not depend on it alone. */
    public static function planNeedsNonTelemetryTrigger(): self
    {
        return new self(
            'A maintenance plan needs at least one distance or time rule. An engine-hours '
            .'rule alone cannot be evaluated, because telemetry is an optional capability.'
        );
    }

    public static function planNeedsAtLeastOneRule(): self
    {
        return new self('A maintenance plan needs at least one schedule rule.');
    }

    public static function workOrderNeedsOdometer(): self
    {
        return new self('Starting a work order requires an odometer reading.');
    }

    public static function workOrderCompletionIncomplete(array $missing): self
    {
        return new self('Cannot complete this work order — missing: '.implode(', ', $missing).'.');
    }

    // ── Inspection guards ─────────────────────────────────────────────────────

    public static function inspectionIsImmutable(): self
    {
        return new self(
            'A submitted inspection cannot be changed. Record a new inspection instead.'
        );
    }

    public static function inspectionMissingMandatoryItems(array $labels): self
    {
        return new self(
            'Every mandatory item must be answered before submitting. Missing: '
            .implode(', ', $labels).'.'
        );
    }

    /** Separation of duties — the performer may not sign off their own critical failure. */
    public static function approverMustDifferFromPerformer(): self
    {
        return new self(
            'An inspection with a critical failure must be approved by someone other than '
            .'the person who performed it.'
        );
    }

    public static function rejectionReasonRequired(): self
    {
        return new self('Rejecting an inspection requires a reason.');
    }

    // ── Defect guards ─────────────────────────────────────────────────────────

    public static function criticalDefectDismissalRequiresOverride(): self
    {
        return new self(
            'Dismissing a critical defect requires the fleet.health.override permission '
            .'and a recorded reason.'
        );
    }

    public static function dismissalReasonRequired(): self
    {
        return new self('Dismissing a defect requires a reason.');
    }

    // ── Fuel and odometer guards ──────────────────────────────────────────────

    public static function odometerRolledBack(float $reading, float $current): self
    {
        return new self(sprintf(
            'Odometer reading %.1f km is below the current accepted reading of %.1f km. '
            .'The reading has been recorded for review but not accepted.',
            $reading,
            $current,
        ));
    }

    public static function fuelNeedsOdometer(): self
    {
        return new self(
            'A fuel transaction requires an odometer reading — without it, efficiency and '
            .'every cost-per-kilometre metric are meaningless.'
        );
    }

    public static function fuelResolutionReasonRequired(): self
    {
        return new self('This fuel transaction outcome requires a reason.');
    }

    // ── Fitness ───────────────────────────────────────────────────────────────

    public static function overrideReasonRequired(): self
    {
        return new self('Overriding a fitness verdict requires a reason.');
    }
}
