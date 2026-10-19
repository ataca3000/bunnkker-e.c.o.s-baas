<?php

declare(strict_types=1);

namespace Modules\POS\Application\Commands;

final readonly class OpenCartCommand
{
    public function __construct(
        public string $sessionId,
        public string $shiftId,
        public string $terminalId,
        public string $cashierId,
        public string $currency,
        public ?string $customerId = null,
    ) {}
}
