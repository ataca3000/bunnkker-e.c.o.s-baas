<?php

declare(strict_types=1);

namespace Modules\POS\Application\Commands;

final readonly class RejectShiftCommand
{
    public function __construct(
        public string $shiftId,
        public string $reason,
    ) {}
}
