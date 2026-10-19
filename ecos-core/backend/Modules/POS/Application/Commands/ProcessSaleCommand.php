<?php

declare(strict_types=1);

namespace Modules\POS\Application\Commands;

final readonly class ProcessSaleCommand
{
    /**
     * @param  array<int, array{type: string, amount: string, currency: string, reference?: string|null}>  $payments
     */
    public function __construct(
        public string $cartId,
        public string $sessionId,
        public string $shiftId,
        public string $terminalId,
        public string $cashierId,
        public ?string $customerId,
        public string $currency,
        public array $payments,
        public ?string $cashierName = null,
        public ?string $customerName = null,
    ) {}
}
