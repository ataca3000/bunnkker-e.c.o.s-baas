<?php

declare(strict_types=1);

namespace Modules\POS\Application\Results;

final readonly class ProcessSaleResult
{
    public function __construct(
        public string $saleId,
        public string $receiptId,
        public string $receiptNumber,
        public string $totalAmount,
        public string $amountPaid,
        public string $changeGiven,
        public string $currency,
    ) {}
}
