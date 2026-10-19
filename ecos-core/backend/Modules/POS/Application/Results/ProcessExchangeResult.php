<?php

declare(strict_types=1);

namespace Modules\POS\Application\Results;

final readonly class ProcessExchangeResult
{
    public function __construct(
        public string $exchangeId,
        public string $exchangeNumber,
        public string $receiptId,
        public string $receiptNumber,
    ) {}
}
