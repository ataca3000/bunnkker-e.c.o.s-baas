<?php

declare(strict_types=1);

namespace Modules\POS\Terminal\Domain\Contracts;

use Modules\POS\Terminal\Domain\Models\Terminal;

interface TerminalRepositoryInterface
{
    public function findById(string $id): ?Terminal;

    public function findByCode(string $code): ?Terminal;

    /** @return Terminal[] */
    public function findByBranch(string $branchId): array;

    public function save(Terminal $terminal): void;

    public function delete(Terminal $terminal): void;

    /** Returns true if a terminal with the given code already exists (excluding the given ID). */
    public function existsByCode(string $code, ?string $excludeId = null): bool;
}
