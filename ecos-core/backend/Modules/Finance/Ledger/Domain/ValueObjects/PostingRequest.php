<?php

declare(strict_types=1);

namespace Modules\Finance\Ledger\Domain\ValueObjects;

use Illuminate\Support\Carbon;

/**
 * A complete request to record one financial fact, before the engine writes it.
 *
 * Immutable. Carries the lines and the context (date, company, origin). It knows
 * how to check its own balance, so the engine never posts an unbalanced entry.
 * The scale is precise: sums use bankers-safe rounding to 4 dp to avoid float
 * drift declaring a balanced entry unbalanced.
 */
final class PostingRequest
{
    /**
     * @param  list<PostingLine>  $lines
     */
    public function __construct(
        public readonly string $companyId,
        public readonly Carbon $entryDate,
        public readonly array $lines,
        public readonly ?string $reference = null,
        public readonly ?string $description = null,
        public readonly string $source = 'manual',
        public readonly ?string $sourceModule = null,
        public readonly ?string $sourceEventId = null,
        public readonly string $journalType = 'general',
    ) {}

    public function isManual(): bool
    {
        return $this->source === 'manual';
    }

    public function totalDebit(): float
    {
        return round(array_sum(array_map(static fn (PostingLine $l) => $l->debit, $this->lines)), 4);
    }

    public function totalCredit(): float
    {
        return round(array_sum(array_map(static fn (PostingLine $l) => $l->credit, $this->lines)), 4);
    }

    public function isBalanced(): bool
    {
        return $this->totalDebit() === $this->totalCredit();
    }

    public function isZero(): bool
    {
        return $this->totalDebit() === 0.0;
    }

    public function lineCount(): int
    {
        return count($this->lines);
    }
}
