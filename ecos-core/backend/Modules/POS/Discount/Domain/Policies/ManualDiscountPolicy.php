<?php

declare(strict_types=1);

namespace Modules\POS\Discount\Domain\Policies;

use Modules\POS\Discount\Domain\ValueObjects\DiscountLimit;
use Modules\POS\Discount\Domain\ValueObjects\DiscountValue;

/**
 * Enforces manual-discount business rules for a POS terminal.
 *
 * Two limits are configured:
 *   - $cashierLimit:     the maximum a cashier may grant without supervisor sign-off.
 *   - $supervisorLimit:  the absolute maximum even with supervisor approval.
 *
 * Any value that exceeds $supervisorLimit is always rejected.
 * A value between $cashierLimit (exclusive) and $supervisorLimit (inclusive)
 * is allowed but requires supervisor approval.
 * A value within $cashierLimit is auto-approved.
 */
final class ManualDiscountPolicy
{
    public function __construct(
        private readonly DiscountLimit $cashierLimit,
        private readonly DiscountLimit $supervisorLimit,
    ) {}

    public static function withLimits(DiscountLimit $cashierLimit, DiscountLimit $supervisorLimit): self
    {
        return new self($cashierLimit, $supervisorLimit);
    }

    /** Throws if the discount value exceeds the supervisor (absolute) limit. */
    public function validate(DiscountValue $value): void
    {
        $this->supervisorLimit->validate($value);
    }

    /** Returns true if the value exceeds the cashier-level limit and requires approval. */
    public function requiresApproval(DiscountValue $value): bool
    {
        return ! $this->cashierLimit->isWithin($value);
    }

    public function cashierLimit(): DiscountLimit
    {
        return $this->cashierLimit;
    }

    public function supervisorLimit(): DiscountLimit
    {
        return $this->supervisorLimit;
    }
}
