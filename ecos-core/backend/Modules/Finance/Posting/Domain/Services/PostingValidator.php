<?php

declare(strict_types=1);

namespace Modules\Finance\Posting\Domain\Services;

use Modules\Finance\Ledger\Domain\ValueObjects\PostingLine;
use Modules\Finance\Ledger\Domain\ValueObjects\PostingRequest;

/**
 * A pre-flight check on a posting request — returns a verdict with reasons
 * rather than throwing, so a caller can decide before committing.
 *
 * It re-states the arithmetic invariants (balance, non-zero, two-sided) as a
 * readable verdict; the Journal Engine still enforces them at the write boundary
 * as the last line of defence. This is defence-in-depth, not duplicated logic —
 * the same rule, checked early and enforced late.
 */
class PostingValidator
{
    /**
     * @return array{valid: bool, reasons: list<string>}
     */
    public function validate(PostingRequest $request): array
    {
        $reasons = [];

        if ($request->lineCount() < 2) {
            $reasons[] = 'A journal needs at least two lines.';
        }

        if ($request->isZero()) {
            $reasons[] = 'A journal must move a non-zero amount.';
        }

        if (! $request->isBalanced()) {
            $reasons[] = sprintf(
                'Unbalanced: debits %s ≠ credits %s.',
                $request->totalDebit(),
                $request->totalCredit(),
            );
        }

        foreach ($request->lines as $index => $line) {
            if (! $line instanceof PostingLine) {
                $reasons[] = "Line {$index} is not a valid posting line.";
            }
        }

        return ['valid' => $reasons === [], 'reasons' => $reasons];
    }

    public function isValid(PostingRequest $request): bool
    {
        return $this->validate($request)['valid'];
    }
}
