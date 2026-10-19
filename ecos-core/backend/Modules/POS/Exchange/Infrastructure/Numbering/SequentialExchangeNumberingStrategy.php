<?php

declare(strict_types=1);

namespace Modules\POS\Exchange\Infrastructure\Numbering;

use DateTimeImmutable;
use Illuminate\Support\Facades\DB;
use Modules\POS\Exchange\Domain\Contracts\ExchangeNumberingStrategyInterface;

/**
 * Generates sequential, per-terminal, per-day exchange numbers.
 *
 * Uses an advisory-lock-safe upsert on pos_exchange_counters so that
 * concurrent exchange operations on the same terminal never collide.
 *
 * Format: EXC-{YYYYMMDD}-{TERMINAL_SHORT}-{SEQUENCE}
 * Example: EXC-20260701-T01-00001
 */
final class SequentialExchangeNumberingStrategy implements ExchangeNumberingStrategyInterface
{
    public function next(string $terminalId, DateTimeImmutable $issuedAt): string
    {
        $date = $issuedAt->format('Y-m-d');
        $displayDate = $issuedAt->format('Ymd');
        $terminalShort = $this->abbreviateTerminalId($terminalId);

        $sequence = DB::transaction(function () use ($terminalId, $date): int {
            DB::table('pos_exchange_counters')
                ->where('terminal_id', $terminalId)
                ->where('counter_date', $date)
                ->lockForUpdate()
                ->first();

            DB::table('pos_exchange_counters')->upsert(
                [
                    'terminal_id' => $terminalId,
                    'counter_date' => $date,
                    'sequence' => 1,
                ],
                ['terminal_id', 'counter_date'],
                ['sequence' => DB::raw('pos_exchange_counters.sequence + 1')],
            );

            return (int) DB::table('pos_exchange_counters')
                ->where('terminal_id', $terminalId)
                ->where('counter_date', $date)
                ->value('sequence');
        });

        return sprintf('EXC-%s-%s-%05d', $displayDate, $terminalShort, $sequence);
    }

    private function abbreviateTerminalId(string $terminalId): string
    {
        $parts = explode('-', $terminalId);

        return strtoupper(substr(end($parts), 0, 6));
    }
}
