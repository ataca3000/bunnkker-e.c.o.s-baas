<?php

declare(strict_types=1);

namespace Modules\POS\Application\Results;

final readonly class OpenShiftResult
{
    public function __construct(
        public string $shiftId,
        public int $shiftNumber,
    ) {}
}
