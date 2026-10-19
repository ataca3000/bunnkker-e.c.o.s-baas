<?php

declare(strict_types=1);

namespace Modules\POS\Application\Commands;

final readonly class CloseShiftCommand
{
    public function __construct(
        public string $shiftId,
        public string $closingCountAmount,
        public string $closingCountCurrency,
    ) {}
}
