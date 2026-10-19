<?php

declare(strict_types=1);

namespace Modules\Finance\Posting\Domain\Strategies;

use Illuminate\Support\Carbon;
use Modules\Finance\Ledger\Domain\ValueObjects\PostingLine;
use Modules\Finance\Ledger\Domain\ValueObjects\PostingRequest;
use Modules\Finance\Posting\Domain\Contracts\PostingStrategyInterface;

/**
 * The one concrete strategy F1 ships: it builds a request from explicit legs
 * supplied in the context.
 *
 * It proves the Strategy seam end-to-end without any operational coupling — the
 * subledger strategies (Inventory, Sales, …) arrive in F3 as siblings of this
 * class, each resolving its own accounts from its own event, and plug into the
 * same coordinator unchanged.
 */
class DirectPostingStrategy implements PostingStrategyInterface
{
    public const EVENT = 'finance.direct';

    public function supports(string $eventType): bool
    {
        return $eventType === self::EVENT;
    }

    /**
     * @param  array<string, mixed>  $context  {company_id, date, reference?, description?,
     *                                          legs: [{account_id, side: debit|credit, amount, dimensions?}]}
     */
    public function build(string $eventType, array $context): PostingRequest
    {
        $companyId = (string) $context['company_id'];

        $lines = array_map(function (array $leg) use ($companyId): PostingLine {
            $dimensions = $leg['dimensions'] ?? [];
            $amount = (float) $leg['amount'];

            return ($leg['side'] === 'debit')
                ? PostingLine::debit((int) $leg['account_id'], $amount, $companyId, $dimensions)
                : PostingLine::credit((int) $leg['account_id'], $amount, $companyId, $dimensions);
        }, $context['legs']);

        return new PostingRequest(
            companyId: $companyId,
            entryDate: isset($context['date']) ? Carbon::parse($context['date']) : Carbon::today(),
            lines: $lines,
            reference: $context['reference'] ?? null,
            description: $context['description'] ?? null,
            source: 'posting',
        );
    }
}
