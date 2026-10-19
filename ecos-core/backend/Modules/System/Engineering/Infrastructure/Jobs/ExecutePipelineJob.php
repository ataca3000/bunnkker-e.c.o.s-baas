<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Infrastructure\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Modules\System\Engineering\Application\Services\ReleasePipelineService;

class ExecutePipelineJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 3600; // 1 hour max
    public int $tries   = 1;

    public function __construct(private readonly string $pipelineId)
    {
        $this->onQueue('engineering');
    }

    public function handle(ReleasePipelineService $service): void
    {
        $service->run($this->pipelineId);
    }
}
