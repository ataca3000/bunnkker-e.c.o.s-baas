<?php

declare(strict_types=1);

namespace Modules\Logistics\Network\Domain\Exceptions;

use Modules\Logistics\Network\Domain\Enums\CapacityCommitmentStatus;
use Modules\Logistics\Network\Domain\Enums\CoverageMemberType;
use Modules\Logistics\Network\Domain\Enums\ServiceAreaStatus;
use RuntimeException;

/** Raised when an operation would violate a Network business rule. Rendered as 422. */
class NetworkException extends RuntimeException
{
    public static function invalidAreaTransition(ServiceAreaStatus $from, ServiceAreaStatus $to): self
    {
        $allowed = array_map(static fn (ServiceAreaStatus $s) => $s->label(), $from->allowedTransitions());

        return new self(sprintf(
            'A service area cannot move from %s to %s. Allowed next states: %s.',
            $from->label(),
            $to->label(),
            $allowed === [] ? 'none — this state is terminal' : implode(', ', $allowed),
        ));
    }

    public static function invalidCommitmentTransition(
        CapacityCommitmentStatus $from,
        CapacityCommitmentStatus $to,
    ): self {
        $allowed = array_map(
            static fn (CapacityCommitmentStatus $s) => $s->label(),
            $from->allowedTransitions(),
        );

        return new self(sprintf(
            'A capacity commitment cannot move from %s to %s. Allowed next states: %s.',
            $from->label(),
            $to->label(),
            $allowed === [] ? 'none — this state is final' : implode(', ', $allowed),
        ));
    }

    /** Directive 8: a member must point at a row that actually exists in V1. */
    public static function memberTargetNotFound(CoverageMemberType $type, string $id): self
    {
        return new self(sprintf(
            'No %s exists with id %s. A service area may only reference geography that already exists.',
            $type->label(),
            $id,
        ));
    }

    public static function memberAlreadyAttached(CoverageMemberType $type, string $id): self
    {
        return new self("That {$type->label()} is already attached to this service area.");
    }

    /**
     * One active area per place per company — otherwise an address resolves to
     * two areas and coverage becomes ambiguous.
     */
    public static function overlappingCoverage(CoverageMemberType $type, string $areaName): self
    {
        return new self(sprintf(
            'That %s is already covered by the active service area "%s". A place may belong to '
            .'at most one active area, or an address would resolve to two.',
            $type->label(),
            $areaName,
        ));
    }

    public static function areaHasNoCoverage(): self
    {
        return new self(
            'A service area cannot be activated with no members. Attach at least one zone, '
            .'city or governorate first.'
        );
    }

    public static function areaNotAcceptingCommitments(ServiceAreaStatus $status): self
    {
        return new self(
            "This service area is {$status->label()} and is not accepting new capacity commitments."
        );
    }

    public static function planNotPublished(): self
    {
        return new self('Capacity cannot be reserved against an unpublished plan.');
    }

    /** @param array<string, float> $shortfall */
    public static function insufficientCapacity(array $shortfall): self
    {
        $parts = [];
        foreach ($shortfall as $unit => $amount) {
            $parts[] = "{$amount} {$unit}";
        }

        return new self('Not enough capacity in this slot. Short by: '.implode(', ', $parts).'.');
    }

    public static function commitmentQuantitiesRequired(): self
    {
        return new self('A capacity commitment must request at least one unit.');
    }

    public static function releaseReasonRequired(): self
    {
        return new self('Releasing a committed reservation requires a reason.');
    }
}
