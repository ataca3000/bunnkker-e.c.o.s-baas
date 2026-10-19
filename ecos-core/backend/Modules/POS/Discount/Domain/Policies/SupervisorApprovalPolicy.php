<?php

declare(strict_types=1);

namespace Modules\POS\Discount\Domain\Policies;

use Modules\POS\Discount\Domain\Exceptions\InvalidDiscountException;

/**
 * Validates that the entity granting supervisor approval is a legitimate actor.
 *
 * The current implementation enforces a non-empty supervisor ID.
 * When a role/permission domain is introduced, this policy can be extended
 * to verify that the supervisor ID carries the required authorization level.
 */
final class SupervisorApprovalPolicy
{
    public function canApprove(string $supervisorId): bool
    {
        return trim($supervisorId) !== '';
    }

    public function validateApprover(string $supervisorId): void
    {
        if (! $this->canApprove($supervisorId)) {
            throw InvalidDiscountException::invalidSupervisor();
        }
    }
}
