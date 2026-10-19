<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingWorkflow\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Manufacturing\AvailabilityEngine\Domain\Services\InventoryAvailabilityEngine;
use Modules\Manufacturing\DecisionOrchestrator\Domain\Services\DecisionOrchestrator;
use Modules\Manufacturing\ManufacturingPlanner\Domain\Services\ManufacturingPlanner;
use Modules\Manufacturing\ManufacturingWorkflow\Domain\Services\ManufacturingWorkflow;

final class ManufacturingWorkflowServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(ManufacturingWorkflow::class, function ($app): ManufacturingWorkflow {
            return new ManufacturingWorkflow(
                orchestrator: $app->make(DecisionOrchestrator::class),
                availabilityEngine: $app->make(InventoryAvailabilityEngine::class),
                planner: $app->make(ManufacturingPlanner::class),
            );
        });
    }
}
