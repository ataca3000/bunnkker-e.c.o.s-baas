<?php

declare(strict_types=1);

namespace Modules\POS\Application\Results;

final readonly class VoidReceiptResult
{
    public function __construct(
        public string $receiptId,
        public string $receiptNumber,
    ) {}
}
