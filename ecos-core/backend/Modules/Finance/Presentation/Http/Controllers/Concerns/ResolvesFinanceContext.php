<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers\Concerns;

use Illuminate\Http\Request;
use Modules\Finance\Ledger\Domain\Models\Account;

/**
 * Shared context resolution for the F2 subledger controllers: the acting
 * company, the acting user id, and the translation of an account UUID (the API
 * surface) to its internal id (what the services and posting engine expect).
 */
trait ResolvesFinanceContext
{
    protected function companyId(Request $request): string
    {
        return (string) $request->user()->company_id;
    }

    protected function actorId(Request $request): ?int
    {
        $user = $request->user();

        return $user !== null ? (int) $user->id : null;
    }

    /** Resolve an account UUID within the company to its internal id. */
    protected function accountId(Request $request, string $uuid): int
    {
        return (int) Account::query()
            ->where('company_id', $this->companyId($request))
            ->where('uuid', $uuid)
            ->firstOrFail()
            ->id;
    }

    /**
     * Resolve a reporting window from the request, defaulting to the trailing 12
     * months ending today. Returns [from, to] as Carbon.
     *
     * @return array{0: \Illuminate\Support\Carbon, 1: \Illuminate\Support\Carbon}
     */
    protected function financeWindow(Request $request): array
    {
        $to = $request->filled('to') ? \Illuminate\Support\Carbon::parse($request->string('to')) : \Illuminate\Support\Carbon::today();
        $from = $request->filled('from')
            ? \Illuminate\Support\Carbon::parse($request->string('from'))
            : $to->copy()->subMonths(11)->startOfMonth();

        return [$from, $to];
    }

    /** Map the API line shape (account_id = uuid) to the service line shape. */
    protected function resolveLineAccounts(Request $request, array $lines, string $accountKey): array
    {
        return array_map(function (array $line) use ($request, $accountKey): array {
            $line[$accountKey] = $this->accountId($request, (string) $line[$accountKey]);

            return $line;
        }, $lines);
    }
}
