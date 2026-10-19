<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Console\Commands;

use Illuminate\Console\Command;
use Modules\System\Engineering\Application\Services\ReleasePipelineService;
use Modules\System\Engineering\Domain\Models\EngineeringPipeline;

class RunPipelineCommand extends Command
{
    protected $signature   = 'engineering:pipeline:run
                                {id? : Pipeline UUID (omit to create and run a new one)}
                                {--task= : Task name for a new pipeline}
                                {--branch=main : Branch for a new pipeline}';

    protected $description = 'Run an Engineering Release Pipeline (or create one and run it immediately)';

    public function handle(ReleasePipelineService $service): int
    {
        $id = $this->argument('id');

        if ($id === null) {
            $pipeline = $service->create([
                'task_name'    => $this->option('task') ?? 'Manual CLI Run',
                'branch'       => $this->option('branch') ?? 'main',
                'initiated_by' => 'CLI',
            ]);
            $id = $pipeline->id;
            $this->info("Created pipeline {$id}");
        } else {
            $pipeline = EngineeringPipeline::find($id);
            if ($pipeline === null) {
                $this->error("Pipeline {$id} not found.");
                return self::FAILURE;
            }
        }

        $this->info("Running pipeline {$id} — {$pipeline->task_name}");
        $this->info("Stages: " . implode(' → ', array_map(
            fn($s) => $s->label(),
            \Modules\System\Engineering\Domain\Enums\PipelineStage::orderedStages()
        )));

        $service->run($id);

        $pipeline->refresh();
        $this->info("Pipeline status: {$pipeline->status} (duration: {$pipeline->durationFormatted()})");

        return $pipeline->status === 'completed' ? self::SUCCESS : self::FAILURE;
    }
}
