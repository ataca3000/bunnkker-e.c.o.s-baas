<?php

declare(strict_types=1);

namespace Modules\POS\Application\Results;

final readonly class ProcessReturnResult
{
    public function __construct(
        public string $returnId,
        public string $returnNumber,
        public string $receiptId,
        public string $receiptNumber,
        public string $refundAmount,
        public string $currency,
    ) {}
}
