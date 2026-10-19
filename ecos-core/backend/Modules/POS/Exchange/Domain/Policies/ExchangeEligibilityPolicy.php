<?php

declare(strict_types=1);

namespace Modules\POS\Exchange\Domain\Policies;

use Modules\POS\Exchange\Domain\Models\Exchange;

/**
 * Encapsulates business eligibility rules for Exchange state transitions.
 *
 * The aggregate enforces its own state invariants (throws on illegal transitions).
 * This policy is used by callers to pre-check eligibility without catching exceptions,
 * and to assert richer compositional rules (e.g. line validity).
 */
final class ExchangeEligibilityPolicy
{
    public function canConfirm(Exchange $exchange): bool
    {
        return $exchange->getStatus()->canBeConfirmed()
            && $this->hasValidLines($exchange);
    }

    public function canComplete(Exchange $exchange): bool
    {
        return $exchange->getStatus()->canBeCompleted();
    }

    public function canCancel(Exchange $exchange): bool
    {
        return $exchange->getStatus()->canBeCancelled();
    }

    public function hasValidLines(Exchange $exchange): bool
    {
        return $this->hasValidReturnedLines($exchange)
            && $this->hasValidReplacementLines($exchange);
    }

    public function hasValidReturnedLines(Exchange $exchange): bool
    {
        return $exchange->getReturnedLineCount() > 0;
    }

    public function hasValidReplacementLines(Exchange $exchange): bool
    {
        return $exchange->getReplacementLineCount() > 0;
    }

    public function isCurrencyConsistent(Exchange $exchange): bool
    {
        $currency = $exchange->currency;

        foreach ($exchange->getReturnedLines() as $line) {
            if ($line->unitPrice->currency !== $currency) {
                return false;
            }
        }

        foreach ($exchange->getReplacementLines() as $line) {
            if ($line->unitPrice->currency !== $currency) {
                return false;
            }
        }

        return true;
    }
}
