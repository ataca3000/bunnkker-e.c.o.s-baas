<?php

declare(strict_types=1);

namespace Modules\POS\CashDrawer\Infrastructure\Repositories;

use Modules\POS\CashDrawer\Domain\Contracts\CashDrawerRepositoryInterface;
use Modules\POS\CashDrawer\Domain\Exceptions\CashDrawerNotFoundException;
use Modules\POS\CashDrawer\Domain\Models\CashDrawer;

final class EloquentCashDrawerRepository implements CashDrawerRepositoryInterface
{
    public function findById(string $id): CashDrawer
    {
        return CashDrawer::find($id) ?? throw CashDrawerNotFoundException::withId($id);
    }

    public function findByShiftId(string $shiftId): CashDrawer
    {
        return CashDrawer::where('shift_id', $shiftId)->first()
            ?? throw CashDrawerNotFoundException::forShift($shiftId);
    }

    public function findBySessionId(string $sessionId): CashDrawer
    {
        return CashDrawer::where('session_id', $sessionId)->first()
            ?? throw CashDrawerNotFoundException::forSession($sessionId);
    }

    public function save(CashDrawer $drawer): void
    {
        $drawer->save();
    }
}
