<?php

declare(strict_types=1);

namespace Modules\POS\Application\Commands;

final readonly class ProcessExchangeCommand
{
    /**
     * Each returned/replacement line must be an ExchangeLine::toArray() compatible array:
     * { original_line_id, product_id, product_name, sku, quantity, unit_price, line_total, sort_order }
     *
     * @param  array<int, array<string, mixed>>  $returnedLines
     * @param  array<int, array<string, mixed>>  $replacementLines
     */
    public function __construct(
        public string $originalSaleId,
        public string $originalSaleNumber,
        public string $sessionId,
        public string $shiftId,
        public string $terminalId,
        public string $cashierId,
        public ?string $customerId,
        public string $currency,
        public array $returnedLines,
        public array $replacementLines,
        public string $reason,
        public ?string $exchangeNumber = null,
        public ?string $notes = null,
        public ?string $cashierName = null,
        public ?string $customerName = null,
    ) {}
}
