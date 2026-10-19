<?php

declare(strict_types=1);

namespace Modules\CostManagement\Providers;

use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use Modules\Admin\Configuration\Domain\Services\ConfigurationManager;
use Modules\CostManagement\Application\Services\CostCalculationEngine;
use Modules\CostManagement\Application\Services\CostImpactEngine;
use Modules\CostManagement\Domain\Events\FinishedProductCostChanged;
use Modules\CostManagement\Domain\Services\CostCascadeService;
use Modules\CostManagement\Domain\Services\MaterialCostService;
use Modules\CostManagement\Domain\Services\PricingReviewService;
use Modules\CostManagement\Domain\Services\ProductCostCalculator;

class CostManagementServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(ProductCostCalculator::class);

        // TASK-COST-ARCH-002 — Enterprise Cost Intelligence Platform
        $this->app->singleton(CostCalculationEngine::class);
        $this->app->singleton(PricingReviewService::class, fn ($app) => new PricingReviewService(
            $app->make(ConfigurationManager::class),
        ));
        $this->app->singleton(CostImpactEngine::class, fn ($app) => new CostImpactEngine(
            $app->make(PricingReviewService::class),
        ));

        $this->app->singleton(CostCascadeService::class, fn ($app) => new CostCascadeService(
            $app->make(CostCalculationEngine::class),
            $app->make(ProductCostCalculator::class),
        ));

        $this->app->singleton(MaterialCostService::class, fn ($app) => new MaterialCostService(
            $app->make(CostCascadeService::class),
            $app->make(PricingReviewService::class),
        ));
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Infrastructure/Database/Migrations');

        // CostImpactEngine listens to FinishedProductCostChanged and drives
        // all pricing review upserts (TASK-COST-ARCH-002 Part 9).
        Event::listen(
            FinishedProductCostChanged::class,
            [CostImpactEngine::class, 'handle'],
        );
    }
}
