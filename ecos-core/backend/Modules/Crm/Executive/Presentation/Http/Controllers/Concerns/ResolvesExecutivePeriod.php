<?php

declare(strict_types=1);

namespace Modules\Crm\Executive\Presentation\Http\Controllers\Concerns;

use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Modules\Crm\Executive\Domain\Support\ExecutivePeriod;

/** Resolves the reporting window a request is asking about. */
trait ResolvesExecutivePeriod
{
    protected function companyId(Request $request): string
    {
        return (string) $request->user()->company_id;
    }

    /**
     * `period=monthly|quarterly|annual|custom` with `year`, `month`, `quarter` or
     * `start`/`end`. Defaults to the current calendar month.
     */
    protected function period(Request $request): ExecutivePeriod
    {
        $request->validate([
            'period' => ['nullable', 'in:monthly,quarterly,annual,custom'],
            'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'month' => ['nullable', 'integer', 'min:1', 'max:12'],
            'quarter' => ['nullable', 'integer', 'min:1', 'max:4'],
            'start' => ['nullable', 'date'],
            'end' => ['nullable', 'date', 'after_or_equal:start'],
        ]);

        $now = Carbon::now();
        $year = (int) $request->integer('year', (int) $now->year);

        return match ($request->string('period', 'monthly')->toString()) {
            'quarterly' => ExecutivePeriod::quarterly($year, (int) $request->integer('quarter', (int) ceil((int) $now->month / 3))),
            'annual' => ExecutivePeriod::annual($year),
            'custom' => ExecutivePeriod::custom(
                Carbon::parse($request->string('start', $now->copy()->startOfMonth()->toDateString())->toString()),
                Carbon::parse($request->string('end', $now->toDateString())->toString()),
            ),
            default => ExecutivePeriod::monthly($year, (int) $request->integer('month', (int) $now->month)),
        };
    }
}
