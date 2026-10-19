<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingService\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Manufacturing\Disassembly\Application\Services\DisassemblyExecutor;
use Modules\Manufacturing\Disassembly\Domain\Services\DisassemblyWorkflow;
use Modules\Manufacturing\ManufacturingExecution\Application\Services\ManufacturingExecutor;
use Modules\Manufacturing\ManufacturingExecution\Domain\Services\ExecutionPipeline;
use Modules\Manufacturing\ManufacturingService\Application\Services\ManufacturingApplicationService;
use Modules\Manufacturing\ManufacturingWorkflow\Domain\Services\ManufacturingWorkflow;

final class ManufacturingServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(
            ManufacturingApplicationService::class,
            function ($app): ManufacturingApplicationService {
                return new ManufacturingApplicationService(
                    workflow: $app->make(ManufacturingWorkflow::class),
                    pipeline: $app->make(ExecutionPipeline::class),
                    executor: $app->make(ManufacturingExecutor::class),
                    disassemblyWorkflow: $app->make(DisassemblyWorkflow::class),
                    disassemblyExecutor: $app->make(DisassemblyExecutor::class),
                );
            },
        );
    }
}
