<?php

declare(strict_types=1);

namespace Modules\POS\Application\Commands;

final readonly class VoidReceiptCommand
{
    public function __construct(
        public string $receiptId,
        public string $cashierId,
        public string $reason = '',
    ) {}
}
