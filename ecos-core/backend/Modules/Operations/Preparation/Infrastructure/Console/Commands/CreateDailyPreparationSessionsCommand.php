<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Infrastructure\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Operations\Preparation\Application\Services\DailyPreparationSessionManager;
use Modules\Organizations\Domain\Models\Company;
use Throwable;

/**
 * CR-PREP-001 — Create daily preparation sessions for all active warehouses.
 *
 * Scheduled to run at the configured auto_create_time (default 06:00) for each
 * warehouse. Safe to run multiple times — ensureSessionExists() is idempotent.
 *
 * Usage:
 *   php artisan preparation:create-daily-sessions
 *   php artisan preparation:create-daily-sessions --company=<uuid>
 *   php artisan preparation:create-daily-sessions --warehouse=<uuid>
 */
final class CreateDailyPreparationSessionsCommand extends Command
{
    protected $signature = 'preparation:create-daily-sessions
                            {--company= : Limit to a specific company UUID}
                            {--warehouse= : Limit to a specific warehouse UUID}
                            {--date= : Business date (Y-m-d), defaults to today}';

    protected $description = 'Auto-create daily preparation sessions for all active warehouses';

    public function handle(DailyPreparationSessionManager $manager): int
    {
        $businessDate = $this->option('date')
            ? now()->parse($this->option('date'))
            : today();

        $companyFilter = $this->option('company');
        $warehouseFilter = $this->option('warehouse');

        $this->info("Creating preparation sessions for {$businessDate->toDateString()}...");

        $warehouseQuery = Warehouse::query()->where('is_active', true);

        if ($warehouseFilter !== null) {
            $warehouseQuery->where('id', $warehouseFilter);
        } elseif ($companyFilter !== null) {
            $warehouseQuery->where('company_id', $companyFilter);
        }

        $warehouses = $warehouseQuery->get();
        $created = 0;
        $existing = 0;
        $failed = 0;

        foreach ($warehouses as $warehouse) {
            try {
                $hadSession = $this->sessionAlreadyExists($warehouse->id, $businessDate);
                $manager->ensureSessionExists($warehouse, $businessDate);

                if ($hadSession) {
                    $existing++;
                    $this->line("  SKIP  {$warehouse->name} — session already exists");
                } else {
                    $created++;
                    $this->line("  CREATE {$warehouse->name} — session created");
                }
            } catch (Throwable $e) {
                $failed++;
                $this->error("  FAIL  {$warehouse->name} — {$e->getMessage()}");
                Log::error('CreateDailyPreparationSessions failed', [
                    'warehouse_id' => $warehouse->id,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
            }
        }

        $this->newLine();
        $this->table(
            ['Metric', 'Count'],
            [
                ['Created',    $created],
                ['Already had session', $existing],
                ['Failed',     $failed],
                ['Total',      $created + $existing + $failed],
            ],
        );

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }

    private function sessionAlreadyExists(string $warehouseId, \Carbon\Carbon $date): bool
    {
        return \Modules\Operations\Preparation\Domain\Models\PreparationSession::query()
            ->where('warehouse_id', $warehouseId)
            ->whereDate('planning_date', $date)
            ->whereNotIn('status', ['cancelled'])
            ->exists();
    }
}
