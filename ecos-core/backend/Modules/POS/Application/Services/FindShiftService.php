<?php

declare(strict_types=1);

namespace Modules\POS\Application\Services;

use Modules\POS\Application\Exceptions\ShiftNotFoundException;
use Modules\POS\Shift\Domain\Contracts\ShiftRepositoryInterface;
use Modules\POS\Shift\Domain\Models\Shift;

final class FindShiftService
{
    public function __construct(
        private readonly ShiftRepositoryInterface $shiftRepo,
    ) {}

    public function execute(string $shiftId): Shift
    {
        $shift = $this->shiftRepo->findById($shiftId);

        if ($shift === null) {
            throw ShiftNotFoundException::withId($shiftId);
        }

        return $shift;
    }
}
