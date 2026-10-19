<?php

declare(strict_types=1);

namespace Modules\POS\Application\Results;

final readonly class ReprintReceiptResult
{
    public function __construct(
        public string $receiptId,
        public string $receiptNumber,
        public int $reprintCount,
    ) {}
}
