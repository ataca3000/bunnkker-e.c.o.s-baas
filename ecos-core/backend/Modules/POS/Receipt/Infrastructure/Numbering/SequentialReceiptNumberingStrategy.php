<?php

declare(strict_types=1);

namespace Modules\POS\Receipt\Infrastructure\Numbering;

use DateTimeImmutable;
use Illuminate\Support\Facades\DB;
use Modules\POS\Receipt\Domain\Contracts\ReceiptNumberingStrategyInterface;

/**
 * Generates sequential, per-terminal, per-day receipt numbers.
 *
 * Uses an advisory-lock-safe upsert on pos_receipt_counters so that
 * concurrent receipt issuances on the same terminal never collide.
 *
 * Format: RCP-{YYYYMMDD}-{TERMINAL_SHORT}-{SEQUENCE}
 * Example: RCP-20260701-T01-00001
 *
 * Receipt numbers are independent from Sale numbers (ADR requirement).
 */
final class SequentialReceiptNumberingStrategy implements ReceiptNumberingStrategyInterface
{
    public function next(string $terminalId, DateTimeImmutable $issuedAt): string
    {
        $date = $issuedAt->format('Y-m-d');
        $displayDate = $issuedAt->format('Ymd');
        $terminalShort = $this->abbreviateTerminalId($terminalId);

        $sequence = DB::transaction(function () use ($terminalId, $date): int {
            DB::table('pos_receipt_counters')
                ->where('terminal_id', $terminalId)
                ->where('counter_date', $date)
                ->lockForUpdate()
                ->first();

            DB::table('pos_receipt_counters')->upsert(
                [
                    'terminal_id' => $terminalId,
                    'counter_date' => $date,
                    'sequence' => 1,
                ],
                ['terminal_id', 'counter_date'],
                ['sequence' => DB::raw('pos_receipt_counters.sequence + 1')],
            );

            return (int) DB::table('pos_receipt_counters')
                ->where('terminal_id', $terminalId)
                ->where('counter_date', $date)
                ->value('sequence');
        });

        return sprintf('RCP-%s-%s-%05d', $displayDate, $terminalShort, $sequence);
    }

    private function abbreviateTerminalId(string $terminalId): string
    {
        // Use last 6 chars of the UUID's final segment for uniqueness
        $parts = explode('-', $terminalId);

        return strtoupper(substr(end($parts), -6));
    }
}
