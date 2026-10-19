<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderConfig\Application\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Modules\Marketing\ProviderConfig\Application\Jobs\CheckProviderHealthJob;

/**
 * Dispatches background health check jobs for every company+provider pair
 * that has a credential record.
 *
 * Called by the scheduler at three frequencies:
 *   - hourly   → connection check (default)
 *   - 6-hourly → permissions check (--level=permissions)
 *   - daily    → webhooks + app availability (--level=full)
 *
 * Usage:
 *   php artisan marketing:provider:health-check
 *   php artisan marketing:provider:health-check --provider=meta
 *   php artisan marketing:provider:health-check --level=full
 */
final class DispatchProviderHealthChecksCommand extends Command
{
    protected $signature = 'marketing:provider:health-check
        {--provider= : Limit to a specific provider (e.g. meta)}
        {--level=connection : Check depth: connection | permissions | full}';

    protected $description = 'Dispatch background health checks for all configured marketing providers';

    public function handle(): int
    {
        $query = DB::table('marketing_provider_credentials')
            ->select('company_id', 'provider')
            ->whereNotNull('app_id')
            ->whereNotNull('app_secret');

        if ($provider = $this->option('provider')) {
            $query->where('provider', $provider);
        }

        $records = $query->get();

        if ($records->isEmpty()) {
            $this->info('No configured provider credentials found.');

            return self::SUCCESS;
        }

        $dispatched = 0;
        foreach ($records as $record) {
            CheckProviderHealthJob::dispatch($record->company_id, $record->provider)
                ->onQueue('health');
            $dispatched++;
        }

        $this->info("Dispatched {$dispatched} health check job(s).");

        return self::SUCCESS;
    }
}
