<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Marketing\Automation\Application\Actions\ActivateWorkflowAction;
use Modules\Marketing\Automation\Application\Actions\ArchiveWorkflowAction;
use Modules\Marketing\Automation\Application\Actions\CreateWorkflowFromTemplateAction;
use Modules\Marketing\Automation\Application\Actions\PauseWorkflowAction;
use Modules\Marketing\Automation\Application\Actions\ProcessWorkflowExecutionAction;
use Modules\Marketing\Automation\Application\Actions\SimulateWorkflowAction;
use Modules\Marketing\Automation\Application\Actions\TriggerWorkflowAction;
use Modules\Marketing\Automation\Application\Services\ActionDispatcherService;
use Modules\Marketing\Automation\Application\Services\AudienceSegmentService;
use Modules\Marketing\Automation\Application\Services\AutomationGovernanceService;
use Modules\Marketing\Automation\Application\Services\ConditionEvaluatorService;
use Modules\Marketing\Automation\Application\Services\TriggerResolverService;
use Modules\Marketing\Automation\Application\Services\WorkflowExecutionEngine;
use Modules\Marketing\Automation\Application\Services\WorkflowService;
use Modules\Marketing\Automation\Application\Services\WorkflowSimulatorService;
use Modules\Marketing\Automation\Application\Services\WorkflowTemplateService;
use Modules\Marketing\Automation\Application\Services\WorkflowVersioningService;

class AutomationServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Core services
        $this->app->singleton(WorkflowService::class);
        $this->app->singleton(WorkflowVersioningService::class);
        $this->app->singleton(AudienceSegmentService::class);
        $this->app->singleton(WorkflowTemplateService::class);
        $this->app->singleton(AutomationGovernanceService::class);
        $this->app->singleton(TriggerResolverService::class);
        $this->app->singleton(ConditionEvaluatorService::class);
        $this->app->singleton(ActionDispatcherService::class);

        // Execution engine (depends on other services — resolved lazily)
        $this->app->singleton(WorkflowExecutionEngine::class, fn ($app) => new WorkflowExecutionEngine(
            conditionEvaluator: $app->make(ConditionEvaluatorService::class),
            actionDispatcher: $app->make(ActionDispatcherService::class),
            governanceService: $app->make(AutomationGovernanceService::class),
        ));

        $this->app->singleton(WorkflowSimulatorService::class, fn ($app) => new WorkflowSimulatorService(
            conditionEvaluator: $app->make(ConditionEvaluatorService::class),
            segmentService: $app->make(AudienceSegmentService::class),
        ));

        // Actions
        $this->app->bind(ActivateWorkflowAction::class);
        $this->app->bind(PauseWorkflowAction::class);
        $this->app->bind(ArchiveWorkflowAction::class);
        $this->app->bind(TriggerWorkflowAction::class);
        $this->app->bind(ProcessWorkflowExecutionAction::class);
        $this->app->bind(SimulateWorkflowAction::class);
        $this->app->bind(CreateWorkflowFromTemplateAction::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
