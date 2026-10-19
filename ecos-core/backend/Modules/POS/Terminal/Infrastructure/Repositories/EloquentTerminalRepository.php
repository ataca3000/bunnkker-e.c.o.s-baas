<?php

declare(strict_types=1);

namespace Modules\POS\Terminal\Infrastructure\Repositories;

use Modules\POS\Terminal\Domain\Contracts\TerminalRepositoryInterface;
use Modules\POS\Terminal\Domain\Models\Terminal;

final class EloquentTerminalRepository implements TerminalRepositoryInterface
{
    public function findById(string $id): ?Terminal
    {
        return Terminal::find($id);
    }

    public function findByCode(string $code): ?Terminal
    {
        return Terminal::where('terminal_code', strtoupper(trim($code)))->first();
    }

    /** @return Terminal[] */
    public function findByBranch(string $branchId): array
    {
        return Terminal::where('branch_id', $branchId)
            ->orderBy('terminal_code')
            ->get()
            ->all();
    }

    public function save(Terminal $terminal): void
    {
        $terminal->save();
    }

    public function delete(Terminal $terminal): void
    {
        $terminal->delete();
    }

    public function existsByCode(string $code, ?string $excludeId = null): bool
    {
        $query = Terminal::where('terminal_code', strtoupper(trim($code)));

        if ($excludeId !== null) {
            $query->where('id', '!=', $excludeId);
        }

        return $query->exists();
    }
}
