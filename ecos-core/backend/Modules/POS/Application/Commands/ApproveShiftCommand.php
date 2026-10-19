<?php

declare(strict_types=1);

namespace Modules\POS\Application\Commands;

final readonly class ApproveShiftCommand
{
    public function __construct(
        public string $shiftId,
        public string $expectedClosingAmount,
        public string $expectedClosingCurrency,
    ) {}
}
