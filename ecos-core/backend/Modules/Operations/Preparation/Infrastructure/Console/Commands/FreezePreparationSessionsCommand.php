<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Infrastructure\Console\Commands;

use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Modules\Operations\Preparation\Application\Services\DailyPreparationSessionManager;
use Modules\Operations\Preparation\Domain\Models\PreparationSession;
use Modules\Operations\Preparation\Domain\Models\PreparationSessionPolicy;
use Throwable;

/**
 * CR-PREP-001 Part 3 — Auto-freeze preparation sessions at their configured freeze_time.
 *
 * Runs every minute via the scheduler. Finds sessions whose policy's freeze_time
 * has passed for the current day and whose status is still active. Safe to run
 * multiple times — already-frozen sessions are skipped by the status filter.
 *
 * Usage:
 *   php artisan preparation:freeze-sessions
 *   php artisan preparation:freeze-sessions --warehouse=<uuid>
 */
final class FreezePreparationSessionsCommand extends Command
{
    protected $signature = 'preparation:freeze-sessions
                            {--warehouse= : Limit to a specific warehouse UUID}
                            {--dry-run    : Show what would be frozen without actually freezing}';

    protected $description = 'Auto-freeze preparation sessions whose freeze_time has passed';

    public function handle(DailyPreparationSessionManager $manager): int
    {
        $now = now();
        $today = today()->toDateString();
        $isDryRun = (bool) $this->option('dry-run');
        $warehouseFilter = $this->option('warehouse');

        // Collect all policy IDs that have a freeze_time set and have already passed.
        $policies = PreparationSessionPolicy::query()
            ->whereNotNull('freeze_time')
            ->where('is_active', true)
            ->when($warehouseFilter, fn ($q) => $q->where('warehouse_id', $warehouseFilter))
            ->get();

        $eligible = $policies->filter(function (PreparationSessionPolicy $policy) use ($now): bool {
            // freeze_time is stored as HH:MM:SS — compare against today's wall clock.
            $freezeAt = Carbon::today()->setTimeFromTimeString($policy->freeze_time);

            return $now->greaterThanOrEqualTo($freezeAt);
        });

        if ($eligible->isEmpty()) {
            $this->info('No sessions due for freezing at this time.');

            return self::SUCCESS;
        }

        // Find active sessions for those warehouses today.
        $warehouseIds = $eligible->pluck('warehouse_id')->unique()->values();

        $sessions = PreparationSession::query()
            ->whereIn('warehouse_id', $warehouseIds)
            ->whereDate('planning_date', $today)
            ->whereIn('status', ['draft', 'planning', 'in_progress', 'paused'])
            ->get();

        if ($sessions->isEmpty()) {
            $this->info('No active sessions to freeze.');

            return self::SUCCESS;
        }

        $frozen = 0;
        $failed = 0;

        foreach ($sessions as $session) {
            // Confirm the matched warehouse's policy actually has freeze_time set.
            $policy = $eligible->firstWhere('warehouse_id', $session->warehouse_id);
            if ($policy === null) {
                continue;
            }

            if ($isDryRun) {
                $this->line("  DRY-RUN  session {$session->session_number} (warehouse {$session->warehouse_id}) would be frozen");
                $frozen++;

                continue;
            }

            try {
                $manager->freezeSession($session, 'system');
                $frozen++;
                $this->line("  FROZEN  {$session->session_number}");
            } catch (Throwable $e) {
                $failed++;
                $this->error("  FAIL  {$session->session_number} — {$e->getMessage()}");
                Log::error('FreezePreparationSessions failed', [
                    'session_id' => $session->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $this->newLine();
        $this->table(
            ['Metric', 'Count'],
            [
                ['Frozen', $frozen],
                ['Failed', $failed],
            ],
        );

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }
}
