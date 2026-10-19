<?php

declare(strict_types=1);

namespace Modules\Finance\Ledger\Domain\ValueObjects;

use Modules\Finance\Ledger\Domain\Exceptions\FinanceException;

/**
 * One requested line of a journal, before it is written.
 *
 * Immutable. Exactly one of debit / credit is positive — a line that is both, or
 * neither, is rejected at construction, so an unbalanced or ambiguous line can
 * never even reach the engine.
 */
final class PostingLine
{
    public function __construct(
        public readonly int $accountId,
        public readonly float $debit,
        public readonly float $credit,
        public readonly string $companyId,
        public readonly ?string $branchId = null,
        public readonly ?int $costCenterId = null,
        public readonly ?string $description = null,
        public readonly ?string $profitCenterId = null,
        public readonly ?string $projectId = null,
        public readonly ?string $campaignId = null,
        public readonly string $currency = 'EGP',
    ) {
        // Exactly one side, strictly positive.
        $debitSide = $debit > 0.0 && $credit === 0.0;
        $creditSide = $credit > 0.0 && $debit === 0.0;

        if (! $debitSide && ! $creditSide) {
            throw FinanceException::lineNotSingleSided();
        }
    }

    public static function debit(int $accountId, float $amount, string $companyId, array $dimensions = []): self
    {
        return new self($accountId, $amount, 0.0, $companyId, ...self::dims($dimensions));
    }

    public static function credit(int $accountId, float $amount, string $companyId, array $dimensions = []): self
    {
        return new self($accountId, 0.0, $amount, $companyId, ...self::dims($dimensions));
    }

    public function isDebit(): bool
    {
        return $this->debit > 0.0;
    }

    /** @param array<string, mixed> $d @return array<string, mixed> */
    private static function dims(array $d): array
    {
        return [
            'branchId' => $d['branchId'] ?? null,
            'costCenterId' => $d['costCenterId'] ?? null,
            'description' => $d['description'] ?? null,
            'profitCenterId' => $d['profitCenterId'] ?? null,
            'projectId' => $d['projectId'] ?? null,
            'campaignId' => $d['campaignId'] ?? null,
            'currency' => $d['currency'] ?? 'EGP',
        ];
    }
}
