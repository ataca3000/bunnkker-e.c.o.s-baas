<?php

declare(strict_types=1);

namespace Modules\POS\Receipt\Domain\Policies;

use Modules\POS\Receipt\Domain\Enums\ReceiptStatus;
use Modules\POS\Receipt\Domain\Models\Receipt;
use Modules\POS\Receipt\Domain\Models\ReceiptTemplate;

/**
 * Encapsulates reprint eligibility and voiding rules for a Receipt.
 *
 * Callers use this policy to pre-check eligibility without catching exceptions.
 * The aggregate's reprint() and void() still enforce the same invariants.
 */
final class ReprintPolicy
{
    public const DEFAULT_MAX_REPRINTS = 10;

    public function canReprint(Receipt $receipt, ?ReceiptTemplate $template = null): bool
    {
        if ($receipt->getStatus() !== ReceiptStatus::Issued) {
            return false;
        }

        return $receipt->reprint_count < $this->maxReprints($template);
    }

    public function canVoid(Receipt $receipt): bool
    {
        return $receipt->getStatus()->canBeVoided();
    }

    public function wouldExceedReprintLimit(Receipt $receipt, ?ReceiptTemplate $template = null): bool
    {
        return ($receipt->reprint_count + 1) > $this->maxReprints($template);
    }

    public function maxReprints(?ReceiptTemplate $template = null): int
    {
        if ($template !== null) {
            $max = $template->getSetting('max_reprints');
            if (is_int($max) && $max > 0) {
                return $max;
            }
        }

        return self::DEFAULT_MAX_REPRINTS;
    }
}
