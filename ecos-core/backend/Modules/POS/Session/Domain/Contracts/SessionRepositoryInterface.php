<?php

declare(strict_types=1);

namespace Modules\POS\Session\Domain\Contracts;

use Modules\POS\Session\Domain\Models\Session;

interface SessionRepositoryInterface
{
    public function findById(string $id): ?Session;

    /** Returns the currently Open session for the given cashier, or null if none exists. */
    public function findOpenByCashier(string $cashierId): ?Session;

    /** Returns true if the cashier currently has an Open session. */
    public function hasOpenSessionForCashier(string $cashierId): bool;

    /** @deprecated Use findOpenByCashier(). terminal_id now holds cashier_id. */
    public function findOpenByTerminal(string $terminalId): ?Session;

    /** @deprecated Use hasOpenSessionForCashier(). terminal_id now holds cashier_id. */
    public function hasOpenSessionForTerminal(string $terminalId): bool;

    public function save(Session $session): void;
}
