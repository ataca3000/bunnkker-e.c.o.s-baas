<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Console\Commands;

use Illuminate\Console\Command;
use Modules\System\Engineering\Application\Services\ImportEngineeringReportService;

final class ImportEngineeringReportCommand extends Command
{
    protected $signature = 'engineering:import
        {--file= : Import a specific JSON file instead of scanning the reports directory}';

    protected $description = 'Import engineering certification reports from engineering/certification/reports/ into the database';

    public function handle(ImportEngineeringReportService $service): int
    {
        $file = $this->option('file');

        if ($file) {
            if (! file_exists($file)) {
                $this->error("File not found: {$file}");
                return self::FAILURE;
            }

            try {
                $run = $service->importFile($file);
                $this->info("Imported run {$run->id} (score: {$run->overall_score}/100)");
                return self::SUCCESS;
            } catch (\Throwable $e) {
                $this->error("Failed to import {$file}: " . $e->getMessage());
                return self::FAILURE;
            }
        }

        $this->info('Scanning for new certification reports…');
        $count = $service->importAll();

        if ($count === 0) {
            $this->line('No new reports found.');
        } else {
            $this->info("Imported {$count} new certification run(s).");
        }

        return self::SUCCESS;
    }
}
