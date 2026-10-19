<?php

declare(strict_types=1);

namespace Modules\POS\Application\Results;

final readonly class CloseShiftResult
{
    public function __construct(public string $shiftId) {}
}
