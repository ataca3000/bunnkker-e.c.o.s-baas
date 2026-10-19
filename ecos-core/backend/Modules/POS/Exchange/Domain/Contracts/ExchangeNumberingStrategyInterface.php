<?php

declare(strict_types=1);

namespace Modules\POS\Exchange\Domain\Contracts;

use DateTimeImmutable;

interface ExchangeNumberingStrategyInterface
{
    /**
     * Generate the next exchange number for the given terminal on the given date.
     *
     * The returned string must be unique within the system.
     */
    public function next(string $terminalId, DateTimeImmutable $issuedAt): string;
}
