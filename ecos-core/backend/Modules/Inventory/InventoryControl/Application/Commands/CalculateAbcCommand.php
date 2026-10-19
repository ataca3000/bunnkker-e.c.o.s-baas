<?php

declare(strict_types=1);

namespace Modules\Inventory\InventoryControl\Application\Commands;

use Illuminate\Console\Command;
use Modules\Inventory\InventoryControl\Application\Services\AbcClassificationService;

class CalculateAbcCommand extends Command
{
    protected $signature = 'inventory:calculate-abc
                            {--dry-run : Show what would change without writing to the database}';

    protected $description = 'Recalculate ABC inventory classifications and update cycle count plans';

    public function handle(AbcClassificationService $service): int
    {
        $this->info('Calculating ABC inventory classifications…');

        if ($this->option('dry-run')) {
            $this->warn('[dry-run] No changes will be written.');

            return self::SUCCESS;
        }

        $summary = $service->recalculate();

        $this->table(
            ['Class', 'Products'],
            [
                ['A (High Value — Monthly)',      $summary['A']],
                ['B (Medium Value — Quarterly)',  $summary['B']],
                ['C (Low Value — Semi-Annual)',   $summary['C']],
                ['Total',                         $summary['total']],
            ],
        );

        $this->info('ABC classification complete. Cycle count plans updated.');

        return self::SUCCESS;
    }
}
