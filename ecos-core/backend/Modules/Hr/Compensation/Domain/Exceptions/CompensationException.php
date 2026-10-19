<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Exceptions;

use RuntimeException;

/** Every way the compensation domain refuses an instruction, named. */
final class CompensationException extends RuntimeException
{
    public static function periodNotRecalculable(string $status): self
    {
        return new self("A period that is {$status} cannot be recalculated.");
    }

    public static function periodClosedToAdjustments(string $status): self
    {
        return new self("A period that is {$status} no longer accepts bonuses, deductions or advances.");
    }

    public static function invalidPeriodTransition(string $from, string $to): self
    {
        return new self("A payroll period cannot move from {$from} to {$to}.");
    }

    public static function invalidRunTransition(string $from, string $to): self
    {
        return new self("A payroll run cannot move from {$from} to {$to}.");
    }

    public static function noSalaryStructure(string $employeeNumber): self
    {
        return new self("Employee {$employeeNumber} has no salary structure in force for this period.");
    }

    public static function invalidApprovalTransition(string $from, string $to): self
    {
        return new self("This item cannot move from {$from} to {$to}.");
    }

    public static function amountMustBePositive(): self
    {
        return new self('The amount must be greater than zero.');
    }

    public static function installmentsRequired(): self
    {
        return new self('An installment advance must state how many installments to recover it over.');
    }

    public static function advanceNotRecoverable(string $status): self
    {
        return new self("An advance that is {$status} cannot be recovered from pay.");
    }

    public static function tiersRequired(): self
    {
        return new self('A tiered commission rule needs at least one tier.');
    }

    public static function unknownMetric(string $metricKey): self
    {
        return new self("\"{$metricKey}\" is not a metric HR knows how to measure.");
    }

    /**
     * Part 7 — the refusal that protects approved pay.
     *
     * It names the period, the date, and the way forward. A bare "locked" is what
     * gets escalated to somebody with a database client.
     */
    public static function componentLocked(string $periodCode, string $approvedOn): self
    {
        return new self(
            "Payroll for {$periodCode} was approved on {$approvedOn}; bonuses, commissions, "
            .'deductions and advances behind it can no longer be edited. Raise a compensation '
            .'adjustment against an open period instead.'
        );
    }

    public static function adjustmentNeedsOpenPeriod(): self
    {
        return new self('An adjustment must be carried in a payroll period that has not been approved yet.');
    }

    public static function invalidAdjustmentTransition(string $from, string $to): self
    {
        return new self("A compensation adjustment cannot move from {$from} to {$to}.");
    }

    public static function adjustmentReasonRequired(): self
    {
        return new self('An adjustment against approved payroll requires a reason.');
    }

    /** Part 8 — a rule's economics are versioned, never overwritten. */
    public static function ruleEconomicsAreVersioned(): self
    {
        return new self(
            'The rate, metric, method, tiers and limits of a commission rule cannot be edited in '
            .'place, because historical payroll was calculated from them. Create a new version '
            .'effective from a date instead.'
        );
    }

    public static function versionEffectiveDateRequired(): self
    {
        return new self('A new commission rule version needs an effective-from date.');
    }

    public static function versionOverlapsHistory(string $effectiveFrom, string $lastPaidPeriod): self
    {
        return new self(
            "A new version cannot take effect on {$effectiveFrom}: payroll has already been approved "
            ."through {$lastPaidPeriod}, and backdating would recalculate pay that has been announced."
        );
    }

    public static function alreadyApproved(): self
    {
        return new self('This payroll run has already been approved; a correction is a new run.');
    }
}
