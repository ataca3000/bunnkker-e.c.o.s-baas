<?php

declare(strict_types=1);

namespace Modules\Hr\Workforce\Domain\Exceptions;

use RuntimeException;

/** Every way the workforce domain refuses an instruction, named. */
final class WorkforceException extends RuntimeException
{
    public static function invalidStatusTransition(string $from, string $to): self
    {
        return new self("An employee cannot move from {$from} to {$to}.");
    }

    public static function alreadyTerminated(): self
    {
        return new self('This employee has already left the company.');
    }

    public static function employeeAlreadyHasActiveContract(): self
    {
        return new self('This employee already has an active contract. Terminate or expire it first.');
    }

    public static function invalidContractTransition(string $from, string $to): self
    {
        return new self("A contract cannot move from {$from} to {$to}.");
    }

    public static function contractEndDateRequired(string $type): self
    {
        return new self("A {$type} contract must have an end date.");
    }

    public static function contractEndsBeforeItStarts(): self
    {
        return new self('A contract cannot end before it starts.');
    }

    public static function departmentCycle(): self
    {
        return new self('That would make the department its own ancestor.');
    }

    public static function reportingCycle(): self
    {
        return new self('That would make the employee their own manager, directly or through the chain.');
    }

    public static function cannotManageSelf(): self
    {
        return new self('An employee cannot report to themselves.');
    }

    public static function positionFull(string $title): self
    {
        return new self("The position \"{$title}\" has reached its headcount limit.");
    }

    public static function crossCompany(): self
    {
        return new self('Workforce records cannot be linked across companies.');
    }
}
