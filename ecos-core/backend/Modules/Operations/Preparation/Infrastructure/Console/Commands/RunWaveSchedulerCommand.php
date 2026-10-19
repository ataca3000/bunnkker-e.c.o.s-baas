<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Infrastructure\Console\Commands;

use Carbon\Carbon;
use Illuminate\Console\Command;
use Modules\Operations\Preparation\Application\Services\WaveEngine\WaveLifecycleService;
use Modules\Operations\Preparation\Application\Services\WaveEngine\WaveManager;
use Modules\Operations\Preparation\Application\Services\WaveEngine\WaveMembershipService;
use Modules\Operations\Preparation\Application\Services\WaveEngine\WavePreparationService;
use Modules\Operations\Preparation\Domain\Enums\WaveStatus;
use Modules\Operations\Preparation\Domain\Models\WaveEngineConfiguration;
use Throwable;

final class RunWaveSchedulerCommand extends Command
{
    protected $signature = 'wave:run-scheduler';

    protected $description = 'Process wave lifecycle transitions (collection open, preparation start, wave close+rotate) based on per-warehouse schedule configuration.';

    public function __construct(
        private readonly WaveManager $waveManager,
        private readonly WaveLifecycleService $lifecycle,
        private readonly WaveMembershipService $membership,
        private readonly WavePreparationService $preparation,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $configs = WaveEngineConfiguration::where('is_active', true)->get();

        if ($configs->isEmpty()) {
            $this->line('No active wave engine configurations found.');

            return Command::SUCCESS;
        }

        foreach ($configs as $config) {
            try {
                $this->processWarehouse($config);
            } catch (Throwable $e) {
                // Log and continue — one bad warehouse must not block others
                $this->error(
                    "Wave scheduler error for warehouse {$config->warehouse_id}: {$e->getMessage()}",
                );
                report($e);
            }
        }

        return Command::SUCCESS;
    }

    private function processWarehouse(WaveEngineConfiguration $config): void
    {
        $now = Carbon::now()->setTimezone($config->timezone);
        $today = $now->toDateString();
        $time = $now->format('H:i');

        // ── Step 1: Open collection window ───────────────────────────────────────
        if (
            $config->auto_create
            && $time >= substr($config->collection_start_time, 0, 5)
            && ! $this->waveManager->hasActiveWave($config->company_id, $config->warehouse_id)
        ) {
            $wave = $this->lifecycle->createCollectingWave(
                $config->company_id,
                $config->warehouse_id,
                $today,
            );
            $this->line("  [Wave Engine] Created collecting wave {$wave->wave_number} for warehouse {$config->warehouse_id}");
        }

        // ── Step 2: Sync eligible orders into the active wave ─────────────────────
        $activeWave = $this->waveManager->getActiveWave($config->company_id, $config->warehouse_id);

        if ($activeWave === null) {
            return;
        }

        if (
            $config->auto_assign_orders
            && in_array($activeWave->status, [WaveStatus::Collecting, WaveStatus::Preparing], true)
        ) {
            $count = $this->membership->attachEligibleOrders($activeWave, $config);

            if ($count > 0) {
                $this->line("  [Wave Engine] Attached {$count} order(s) to wave {$activeWave->wave_number}");
            }
        }

        // Re-fetch after potential membership changes
        $activeWave = $activeWave->refresh();

        // ── Step 3: Start preparation window ─────────────────────────────────────
        if (
            $config->auto_move_to_preparing
            && $activeWave->status === WaveStatus::Collecting
            && $time >= substr($config->preparation_start_time, 0, 5)
        ) {
            $this->preparation->startPreparation($activeWave);
            $this->line("  [Wave Engine] Started preparation for wave {$activeWave->wave_number}");
        }

        // ── Step 4: Close wave and rotate at end time ─────────────────────────────
        if (
            $activeWave->status === WaveStatus::Preparing
            && $time >= substr($config->wave_end_time, 0, 5)
        ) {
            $newWave = $this->lifecycle->rotateWave($activeWave);
            $this->line("  [Wave Engine] Rotated wave {$activeWave->wave_number} → {$newWave->wave_number} for warehouse {$config->warehouse_id}");
        }
    }
}
