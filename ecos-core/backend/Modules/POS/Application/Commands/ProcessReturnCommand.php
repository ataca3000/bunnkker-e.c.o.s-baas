<?php

declare(strict_types=1);

namespace Modules\POS\Application\Commands;

final readonly class ProcessReturnCommand
{
    /**
     * Each line must be a ReturnLine::toArray() compatible array:
     * { line_id, product_id, product_name, sku, quantity, unit_price, refund_amount, reason, should_restock, sort_order }
     *
     * @param  array<int, array<string, mixed>>  $lines
     */
    public function __construct(
        public string $saleId,
        public string $originalReceiptNumber,
        public string $sessionId,
        public string $shiftId,
        public string $terminalId,
        public string $cashierId,
        public ?string $customerId,
        public string $currency,
        public array $lines,
        public string $refundTotalAmount,
        public string $refundMethod,
        public ?string $returnNumber = null,
        public ?string $notes = null,
        public ?string $cashierName = null,
        public ?string $customerName = null,
    ) {}
}
