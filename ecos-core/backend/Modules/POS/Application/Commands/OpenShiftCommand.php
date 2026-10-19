<?php

declare(strict_types=1);

namespace Modules\POS\Application\Commands;

final readonly class OpenShiftCommand
{
    public function __construct(
        public string $sessionId,
        public string $terminalId,
        public string $cashierId,
        public string $openingCashAmount,
        public string $openingCashCurrency,
    ) {}
}
