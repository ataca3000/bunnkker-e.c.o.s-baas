<?php

declare(strict_types=1);

namespace Modules\POS\Receipt\Domain\Contracts;

use DateTimeImmutable;

interface ReceiptNumberingStrategyInterface
{
    /**
     * Generate the next receipt number for the given terminal on the given date.
     *
     * The returned string must be unique within the system.
     * Receipt numbers are independent from Sale numbers.
     */
    public function next(string $terminalId, DateTimeImmutable $issuedAt): string;
}
