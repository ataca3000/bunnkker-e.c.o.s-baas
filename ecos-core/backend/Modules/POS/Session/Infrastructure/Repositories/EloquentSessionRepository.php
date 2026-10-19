<?php

declare(strict_types=1);

namespace Modules\POS\Session\Infrastructure\Repositories;

use Modules\POS\Session\Domain\Contracts\SessionRepositoryInterface;
use Modules\POS\Session\Domain\Models\Session;
use Modules\POS\Shared\Domain\Enums\SessionStatus;

final class EloquentSessionRepository implements SessionRepositoryInterface
{
    public function findById(string $id): ?Session
    {
        return Session::find($id);
    }

    public function findOpenByCashier(string $cashierId): ?Session
    {
        return Session::where('cashier_id', $cashierId)
            ->where('status', SessionStatus::Open->value)
            ->first();
    }

    public function hasOpenSessionForCashier(string $cashierId): bool
    {
        return Session::where('cashier_id', $cashierId)
            ->where('status', SessionStatus::Open->value)
            ->exists();
    }

    public function findOpenByTerminal(string $terminalId): ?Session
    {
        return $this->findOpenByCashier($terminalId);
    }

    public function hasOpenSessionForTerminal(string $terminalId): bool
    {
        return $this->hasOpenSessionForCashier($terminalId);
    }

    public function save(Session $session): void
    {
        $session->save();
    }
}
