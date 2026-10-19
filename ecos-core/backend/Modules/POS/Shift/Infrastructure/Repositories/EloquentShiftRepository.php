<?php

declare(strict_types=1);

namespace Modules\POS\Shift\Infrastructure\Repositories;

use Modules\POS\Shared\Domain\Enums\ShiftStatus;
use Modules\POS\Shift\Domain\Contracts\ShiftRepositoryInterface;
use Modules\POS\Shift\Domain\Models\Shift;

final class EloquentShiftRepository implements ShiftRepositoryInterface
{
    public function findById(string $id): ?Shift
    {
        return Shift::find($id);
    }

    public function findOpenBySession(string $sessionId): ?Shift
    {
        return Shift::where('session_id', $sessionId)
            ->where('status', ShiftStatus::Open->value)
            ->first();
    }

    public function countByTerminal(string $terminalId): int
    {
        return Shift::where('terminal_id', $terminalId)->count();
    }

    public function save(Shift $shift): void
    {
        $shift->save();
    }
}
