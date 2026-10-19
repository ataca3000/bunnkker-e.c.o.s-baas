<?php

declare(strict_types=1);

namespace Modules\POS\CashDrawer\Domain\Contracts;

use Modules\POS\CashDrawer\Domain\Models\CashDrawer;

interface CashDrawerRepositoryInterface
{
    public function findById(string $id): ?CashDrawer;

    public function findByShiftId(string $shiftId): ?CashDrawer;

    public function findBySessionId(string $sessionId): ?CashDrawer;

    public function save(CashDrawer $drawer): void;
}
