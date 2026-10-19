<?php

declare(strict_types=1);

namespace Modules\POS\Shift\Domain\Contracts;

use Modules\POS\Shift\Domain\Models\Shift;

interface ShiftRepositoryInterface
{
    public function findById(string $id): ?Shift;

    /** Returns the Open shift for the given session, or null if the session has no open shift. */
    public function findOpenBySession(string $sessionId): ?Shift;

    /** Returns the total number of shifts recorded for a terminal (used for ShiftNumber assignment). */
    public function countByTerminal(string $terminalId): int;

    public function save(Shift $shift): void;
}
