<?php

declare(strict_types=1);

namespace Modules\POS\Returns\Domain\Contracts;

use DateTimeImmutable;

interface ReturnNumberingStrategyInterface
{
    /**
     * Generate the next return number for the given terminal on the given date.
     *
     * The returned string must be unique within the system.
     */
    public function next(string $terminalId, DateTimeImmutable $issuedAt): string;
}
